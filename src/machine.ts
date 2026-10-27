import {
  ACESFilmicToneMapping,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { BufferGeometry, Material, Texture, WebGLRenderTarget } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

type MachineOptions = {
  screenButton: HTMLButtonElement;
  channelControls: HTMLElement;
  initialProject: string;
  isMotionEnabled: () => boolean;
  onReady: (ready: boolean) => void;
  onAssetError: (message: string) => void;
};

export type MachineController = {
  setProject: (id: string) => void;
  dispose: () => void;
};

export function createMachine(container: HTMLElement, options: MachineOptions): MachineController {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  container.append(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 1.15, 11.9);
  camera.lookAt(0, -0.4, 0);

  function createEnvironment(): WebGLRenderTarget {
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    try {
      return pmrem.fromScene(room, 0.045);
    } finally {
      room.dispose();
      pmrem.dispose();
    }
  }

  let environment = createEnvironment();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.8;

  const keyLight = new DirectionalLight(0xfff0db, 2.3);
  keyLight.position.set(-5, 7, 7);
  scene.add(keyLight);
  const rimLight = new DirectionalLight(0xc7b4ed, 1.8);
  rimLight.position.set(6, 2, -2);
  scene.add(rimLight);
  const fillLight = new DirectionalLight(0xe9f3d9, 1);
  fillLight.position.set(-3, -1, 5);
  scene.add(fillLight);

  const machine = new Group();
  machine.position.set(0, 0.15, 0);
  scene.add(machine);

  const shell = new MeshPhysicalMaterial({
    color: 0x9c85bd,
    roughness: 0.32,
    metalness: 0.24,
    clearcoat: 0.6,
    clearcoatRoughness: 0.27,
  });
  const darkShell = new MeshStandardMaterial({ color: 0x7c6c98, roughness: 0.4, metalness: 0.18 });
  const rim = new MeshStandardMaterial({ color: 0xdbd3dc, roughness: 0.28, metalness: 0.42 });
  const screenRim = new MeshStandardMaterial({ color: 0x342d40, roughness: 0.42, metalness: 0.14 });
  const keyMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.05,
  });
  const ventMaterial = new MeshStandardMaterial({ color: 0x736281, roughness: 0.7 });
  const orangeMaterial = new MeshPhysicalMaterial({
    color: 0xe6a17c,
    roughness: 0.3,
    clearcoat: 0.5,
  });
  const ledMaterial = new MeshStandardMaterial({
    color: 0xe0eaba,
    emissive: 0xb1cc7c,
    emissiveIntensity: 0.5,
    roughness: 0.2,
  });

  const textures = new Set<Texture>();
  const screenCache = new Map<string, Promise<Texture>>();
  let disposed = false;
  let contextLost = false;
  let requestedProject = options.initialProject;
  let ready = false;
  let artworkSettled = false;
  let visible = true;
  let needsRender = true;
  let width = 0;
  let height = 0;
  let channelAnimations: Animation[] = [];

  function box(
    width: number,
    height: number,
    depth: number,
    radius: number,
    material: Material,
    x: number,
    y: number,
    z: number,
  ): Mesh {
    const mesh = new Mesh(new RoundedBoxGeometry(width, height, depth, 3, radius), material);
    mesh.position.set(x, y, z);
    machine.add(mesh);
    return mesh;
  }

  box(5.25, 3.75, 1.66, 0.28, shell, 0, 0.15, 0);
  box(4.9, 3.3, 0.48, 0.2, darkShell, 0, 0.17, -0.81);
  box(4.71, 3.14, 0.13, 0.15, rim, -0.04, 0.26, 0.84);
  box(3.89, 2.8, 0.13, 0.2, screenRim, -0.36, 0.32, 0.94);
  box(0.62, 2.74, 0.04, 0.045, shell, 2.01, 0.33, 0.933);

  function labelTexture(
    width: number,
    height: number,
    draw: (context: CanvasRenderingContext2D) => void,
  ): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The terminal could not create its artwork canvas.');
    draw(context);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    textures.add(texture);
    return texture;
  }

  function screenMessage(message: string): CanvasTexture {
    return labelTexture(1024, 768, (context) => {
      context.fillStyle = '#292137';
      context.fillRect(0, 0, 1024, 768);
      context.fillStyle = '#cfc1e6';
      context.font = '24px monospace';
      context.fillText('E / OS — THE CURIOSITY TERMINAL', 80, 100);
      context.font = 'bold 74px Arial';
      context.fillStyle = '#e5ecd1';
      context.fillText('Ideas,', 80, 330);
      context.font = 'italic 94px Georgia';
      context.fillText('in progress.', 80, 437);
      context.font = '20px monospace';
      context.fillStyle = '#bdb1d2';
      context.fillText(message, 80, 636);
    });
  }

  const screenMaterial = new MeshBasicMaterial({
    map: screenMessage('LOADING PROJECT ARTWORK...'),
    toneMapped: false,
    transparent: true,
  });
  const screen = new Mesh(new PlaneGeometry(3.58, 2.58), screenMaterial);
  screen.position.set(-0.36, 0.34, 1.013);
  machine.add(screen);

  const staticOverlay = document.createElement('span');
  staticOverlay.className = 'terminal-static';
  staticOverlay.setAttribute('aria-hidden', 'true');
  const staticGrain = document.createElement('span');
  staticGrain.className = 'terminal-static-grain';
  staticOverlay.append(staticGrain);
  options.screenButton.append(staticOverlay);
  container.dataset.channelState = 'ready';

  const reflectionTexture = labelTexture(512, 512, (context) => {
    const gradient = context.createLinearGradient(0, 0, 380, 512);
    gradient.addColorStop(0, '#ffffff25');
    gradient.addColorStop(0.35, '#ffffff08');
    gradient.addColorStop(0.6, '#ffffff00');
    context.fillStyle = gradient;
    context.beginPath();
    context.roundRect(0, 0, 512, 512, 30);
    context.fill();
  });
  const glass = new Mesh(
    new PlaneGeometry(3.58, 2.58),
    new MeshBasicMaterial({ map: reflectionTexture, transparent: true, depthWrite: false }),
  );
  glass.position.copy(screen.position);
  glass.position.z += 0.008;
  machine.add(glass);

  const wordmarkTexture = labelTexture(1024, 100, (context) => {
    context.fillStyle = '#51435f';
    context.font = '38px monospace';
    context.fillText('EESHA / PERSONAL SYSTEM', 10, 66);
  });
  const wordmark = new Mesh(
    new PlaneGeometry(2.66, 0.26),
    new MeshBasicMaterial({ map: wordmarkTexture, transparent: true, depthWrite: false }),
  );
  wordmark.position.set(-0.73, -1.46, 0.841);
  machine.add(wordmark);

  const led = new Mesh(new CircleGeometry(0.064, 20), ledMaterial);
  led.position.set(2.01, 1.4, 0.972);
  machine.add(led);
  for (let index = 0; index < 4; index++) {
    box(0.26, 0.035, 0.015, 0.015, ventMaterial, 2.01, 0.91 - index * 0.107, 0.96);
  }
  const dial = new Mesh(new CylinderGeometry(0.154, 0.154, 0.07, 40), rim);
  dial.rotation.x = Math.PI / 2;
  dial.position.set(2.01, -0.91, 0.99);
  machine.add(dial);
  box(0.027, 0.15, 0.018, 0.008, darkShell, 2.01, -0.91, 1.037);
  box(0.39, 0.115, 0.025, 0.035, orangeMaterial, 1.86, -1.46, 0.86);

  box(1.3, 0.6, 1.09, 0.14, darkShell, 0, -1.97, -0.1);
  box(5.57, 0.3, 3.0, 0.12, shell, 0, -2.36, 0.93);
  box(4.78, 0.08, 1.87, 0.08, darkShell, 0, -2.17, 1.11);

  const keyPositions: { x: number; z: number; accent: boolean; mint: boolean }[] = [];
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 12; column++) {
      if (row === 3 && column >= 3 && column <= 8) continue;
      keyPositions.push({
        x: -2.09 + column * 0.38,
        z: 0.52 + row * 0.37,
        accent: column === 11 && row > 0,
        mint: row === 0 && column === 0,
      });
    }
  }
  const keyGeometry = new RoundedBoxGeometry(0.31, 0.12, 0.29, 2, 0.043);
  const keys = new InstancedMesh(keyGeometry, keyMaterial, keyPositions.length);
  const dummy = new Object3D();
  const color = new Color();
  keyPositions.forEach((key, index) => {
    dummy.position.set(key.x, -2.07, key.z);
    dummy.updateMatrix();
    keys.setMatrixAt(index, dummy.matrix);
    keys.setColorAt(index, color.set(key.accent ? 0xe5a17f : key.mint ? 0xd9e5af : 0xe3dce1));
  });
  keys.instanceMatrix.needsUpdate = true;
  if (keys.instanceColor) keys.instanceColor.needsUpdate = true;
  machine.add(keys);
  box(2.18, 0.12, 0.29, 0.044, rim, 0, -2.07, 1.63);
  box(0.8, 0.045, 0.06, 0.014, ventMaterial, 1.81, -2.36, 2.43);

  const cableCurve = new CatmullRomCurve3([
    new Vector3(2.62, -1.14, -0.4),
    new Vector3(2.87, -1.9, -0.3),
    new Vector3(2.97, -2.46, 0.5),
    new Vector3(3.08, -2.5, 1.3),
    new Vector3(2.91, -2.5, 2.28),
    new Vector3(2.58, -2.5, 2.55),
  ]);
  const cable = new Mesh(new TubeGeometry(cableCurve, 48, 0.047, 8, false), screenRim);
  machine.add(cable);

  const viewportMatrix = new Matrix4();
  const screenProjection = new Matrix4();
  const controlProjection = new Matrix4();
  const screenPlane = new Matrix4().set(
    3.58 / 480,
    0,
    0,
    -2.15,
    0,
    -2.58 / 346,
    0,
    1.63,
    0,
    0,
    1,
    1.035,
    0,
    0,
    0,
    1,
  );
  const controlsPlane = new Matrix4().set(
    0.58 / 64,
    0,
    0,
    1.72,
    0,
    -0.58 / 64,
    0,
    0.58,
    0,
    0,
    1,
    1.04,
    0,
    0,
    0,
    1,
  );

  function projectControls(): void {
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    viewportMatrix.set(
      width / 2,
      0,
      0,
      width / 2,
      0,
      -height / 2,
      0,
      height / 2,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
    );
    const projection = viewportMatrix
      .multiply(camera.projectionMatrix)
      .multiply(camera.matrixWorldInverse)
      .multiply(machine.matrixWorld);
    screenProjection.copy(projection).multiply(screenPlane);
    controlProjection.copy(projection).multiply(controlsPlane);
    // Keep native, keyboard-accessible buttons on the same projected surface as the model.
    options.screenButton.style.setProperty(
      '--surface-transform',
      `matrix3d(${screenProjection.elements.join(',')})`,
    );
    options.channelControls.style.setProperty(
      '--surface-transform',
      `matrix3d(${controlProjection.elements.join(',')})`,
    );
  }

  function render(): void {
    if (disposed || contextLost) return;
    needsRender = true;
    if (!visible || document.hidden || !width || !height) return;
    projectControls();
    renderer.render(scene, camera);
    needsRender = false;
    if (!ready && artworkSettled) {
      ready = true;
      options.onReady(true);
    }
  }

  function resize(): void {
    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = camera.aspect < 1.15 ? 12.4 : 11.25;
    camera.lookAt(0, -0.4, 0);
    camera.updateProjectionMatrix();
    render();
  }

  async function loadArtwork(id: string): Promise<Texture> {
    const image = new Image();
    image.decoding = 'async';
    image.src = new URL(`./images/${id}.svg`, window.location.href).href;
    await image.decode();
    if (disposed) throw new Error('Terminal disposed before artwork was ready.');
    return labelTexture(1024, 768, (context) => {
      context.beginPath();
      context.roundRect(0, 0, 1024, 768, 55);
      context.clip();
      const sourceRatio = image.naturalWidth / image.naturalHeight;
      const targetRatio = 4 / 3;
      const sourceWidth =
        sourceRatio > targetRatio ? image.naturalHeight * targetRatio : image.naturalWidth;
      const sourceHeight =
        sourceRatio > targetRatio ? image.naturalHeight : image.naturalWidth / targetRatio;
      context.drawImage(
        image,
        (image.naturalWidth - sourceWidth) / 2,
        (image.naturalHeight - sourceHeight) / 2,
        sourceWidth,
        sourceHeight,
        0,
        0,
        1024,
        768,
      );
      context.fillStyle = '#100a1b0a';
      for (let y = 0; y < 768; y += 4) context.fillRect(0, y, 1024, 1);
    });
  }

  function finishChannelStatic(): void {
    channelAnimations.forEach((animation) => animation.cancel());
    channelAnimations = [];
    staticOverlay.classList.remove('is-active');
    container.dataset.channelState = 'ready';
  }

  function playChannelStatic(): void {
    staticOverlay.classList.add('is-active');
    container.dataset.channelState = 'static';
    const grain = staticGrain.animate(
      [{ transform: 'translate(0, 0)' }, { transform: 'translate(-57px, 33px)' }],
      { duration: 220, easing: 'steps(6, end)' },
    );
    const fade = staticOverlay.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 1, offset: 0.55 },
        { opacity: 0, offset: 1 },
      ],
      { duration: 220 },
    );
    channelAnimations = [grain, fade];
    fade.onfinish = finishChannelStatic;
  }

  function setProject(id: string): void {
    requestedProject = id;
    if (!screenCache.has(id)) screenCache.set(id, loadArtwork(id));
    void screenCache
      .get(id)
      ?.then((texture) => {
        if (disposed || requestedProject !== id) return;
        const showStatic =
          ready &&
          !contextLost &&
          visible &&
          !document.hidden &&
          options.isMotionEnabled() &&
          container.dataset.displayedProject !== id;
        finishChannelStatic();
        screenMaterial.map = texture;
        screenMaterial.needsUpdate = true;
        container.dataset.displayedProject = id;
        artworkSettled = true;
        options.onAssetError('');
        render();
        if (showStatic) playChannelStatic();
      })
      .catch((error: unknown) => {
        screenCache.delete(id);
        if (disposed) return;
        console.warn(`Terminal artwork could not load for ${id}:`, error);
        if (requestedProject !== id) return;
        finishChannelStatic();
        screenMaterial.map = screenMessage('ARTWORK UNAVAILABLE — USE THE PROJECT BUTTONS.');
        screenMaterial.needsUpdate = true;
        artworkSettled = true;
        options.onAssetError('ARTWORK UNAVAILABLE / SELECT THE SCREEN FOR PROJECT DETAILS.');
        render();
      });
  }

  function onVisibilityChange(): void {
    if (document.hidden && channelAnimations.length) finishChannelStatic();
    if (!document.hidden && needsRender) render();
  }
  function onMotionChange(): void {
    if (!options.isMotionEnabled() && channelAnimations.length) {
      finishChannelStatic();
    }
  }
  function onContextLost(event: Event): void {
    event.preventDefault();
    contextLost = true;
    finishChannelStatic();
    ready = false;
    options.onReady(false);
    options.onAssetError(
      'STATIC TERMINAL / GRAPHICS WERE INTERRUPTED. THE CHANNEL BUTTONS STILL WORK.',
    );
  }
  function onContextRestored(): void {
    contextLost = false;
    try {
      environment.dispose();
      environment = createEnvironment();
      scene.environment = environment.texture;
    } catch (error: unknown) {
      contextLost = true;
      console.warn('Terminal lighting could not be restored:', error);
      options.onAssetError(
        'STATIC TERMINAL / GRAPHICS COULD NOT RESTART. THE CHANNEL BUTTONS STILL WORK.',
      );
      return;
    }
    options.onAssetError('');
    resize();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (!visible && channelAnimations.length) finishChannelStatic();
      if (visible && needsRender) render();
    },
    { threshold: 0 },
  );
  visibilityObserver.observe(container);
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('portfolio:motion', onMotionChange);
  resize();
  setProject(options.initialProject);

  return {
    setProject,
    dispose() {
      disposed = true;
      finishChannelStatic();
      staticOverlay.remove();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('portfolio:motion', onMotionChange);
      const geometries = new Set<BufferGeometry>();
      const materials = new Set<Material>();
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        geometries.add(object.geometry);
        const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
        meshMaterials.forEach((material) => materials.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
