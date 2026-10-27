import {
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  MathUtils,
  Mesh,
  OrthographicCamera,
  Plane,
  PlaneGeometry,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  Uint32BufferAttribute,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

export type PortraitController = { dispose: () => void };

export async function createPortrait(
  canvas: HTMLCanvasElement,
  stage: HTMLElement,
  isMotionEnabled: () => boolean,
): Promise<PortraitController> {
  const button = stage.querySelector<HTMLButtonElement>('#portrait-scatter');
  const action = stage.querySelector<HTMLElement>('#portrait-action');
  const counter = stage.querySelector<HTMLElement>('#portrait-count');
  const status = document.querySelector<HTMLElement>('#playground-status');
  if (!button || !action || !counter || !status) {
    throw new Error('The portrait is missing its controls.');
  }
  const scatterButton = button;
  const actionLabel = action;
  const portraitStatus = status;
  const photo = new Image();
  photo.src = new URL('./images/eesha-portrait.webp', window.location.href).href;
  await photo.decode();

  const baseColumns = window.innerWidth <= 760 ? 112 : 144;
  const baseRows = Math.round((baseColumns * photo.naturalHeight) / photo.naturalWidth);
  const detailDensity = 3;
  const columns = baseColumns * detailDensity;
  const rows = baseRows * detailDensity;
  const portraitWidth = 3.6;
  const portraitHeight = (portraitWidth * photo.naturalHeight) / photo.naturalWidth;
  const minimumBrushRadius = 0.2;
  const maximumBrushRadius = 0.9;
  const sampler = document.createElement('canvas');
  sampler.width = columns;
  sampler.height = rows;
  const context = sampler.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser cannot sample the portrait silhouette.');
  context.drawImage(photo, 0, 0, columns, rows);
  const pixels = context.getImageData(0, 0, columns, rows).data;
  const positions: number[] = [];
  const sizes: number[] = [];
  const opacities: number[] = [];
  const colors: number[] = [];
  const baseDots: number[] = [];
  const restOffsets: number[] = [];
  const basePointIndices: number[] = [];
  const flights: number[] = [];
  const phases: number[] = [];
  const sampledColor = new Color();
  const random = (seed: number): number => {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const lightnessAt = (offset: number): number =>
    (pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722) / 255;
  const surfaceDepth = (x: number, y: number, lightness: number): number =>
    Math.exp(-x * x * 1.5 - y * y * 0.65) * 0.16 + (0.5 - lightness) * 0.06;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const index = y * columns + x;
      const offset = index * 4;
      const alpha = pixels[offset + 3] / 255;
      if (alpha < 0.25) continue;
      const baseDot = x % detailDensity === 1 && y % detailDensity === 1;
      if (baseDot) basePointIndices.push(positions.length / 3);
      baseDots.push(baseDot ? 1 : 0);
      const lightness = lightnessAt(offset);
      const tone = lightness < 0.28 ? 0.2 : lightness < 0.48 ? 0.44 : lightness < 0.66 ? 0.72 : 1;
      const px = ((x + 0.5) / columns - 0.5) * portraitWidth;
      const py = (0.5 - (y + 0.5) / rows) * portraitHeight;
      positions.push(px, py, surfaceDepth(px, py, lightness));
      restOffsets.push(
        ((1 - (x % detailDensity)) * portraitWidth) / columns,
        (((y % detailDensity) - 1) * portraitHeight) / rows,
      );
      sizes.push(0.3 + tone * 0.46);
      opacities.push(alpha * (0.6 + tone * 0.4));
      sampledColor.setRGB(
        pixels[offset] / 255,
        pixels[offset + 1] / 255,
        pixels[offset + 2] / 255,
        SRGBColorSpace,
      );
      colors.push(sampledColor.r, sampledColor.g, sampledColor.b);
      flights.push(
        (random(index + 1) - 0.5) * 6.8,
        (random(index + 2) - 0.5) * 5.4,
        (random(index + 3) - 0.5) * 3,
      );
      phases.push(random(index + 4) * Math.PI * 2);
    }
  }

  const pointCount = positions.length / 3;
  const responseScales = Float32Array.from(phases, (phase) => 0.88 + Math.sin(phase) * 0.12);
  const revealPeaks = new Float32Array(pointCount);
  const revealTimes = new Float64Array(pointCount).fill(-Infinity);
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
  camera.position.z = 8;
  const portrait = new Group();
  scene.add(portrait);
  const uniforms = {
    uTime: { value: 0 },
    uScatter: { value: 0 },
    uPointer: { value: new Vector2(-10, -10) },
    uDisturbance: { value: 0 },
    uBrushRadius: { value: minimumBrushRadius },
    uPointScale: { value: 1 },
    uSpacing: { value: portraitWidth / baseColumns },
    uDetailScale: { value: 1 / detailDensity },
    uInk: { value: new Color('#f2dfc0') },
  };
  const geometry = new BufferGeometry();
  const positionAttribute = new Float32BufferAttribute(positions, 3);
  const revealAttribute = new Float32BufferAttribute(new Float32Array(pointCount), 1);
  revealAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('aReveal', revealAttribute);
  geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new Float32BufferAttribute(opacities, 1));
  geometry.setAttribute('aColor', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aBaseDot', new Float32BufferAttribute(baseDots, 1));
  geometry.setAttribute('aRestOffset', new Float32BufferAttribute(restOffsets, 2));
  geometry.setAttribute('aFlight', new Float32BufferAttribute(flights, 3));
  geometry.setAttribute('aPhase', new Float32BufferAttribute(phases, 1));
  // Idle frames draw only the coarse surface, before the reveal-only points.
  const basePointCount = basePointIndices.length;
  const drawIndices = new Uint32BufferAttribute(new Uint32Array(pointCount), 1);
  drawIndices.array.set(basePointIndices);
  drawIndices.setUsage(DynamicDrawUsage);
  geometry.setIndex(drawIndices);
  const material = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      attribute vec3 aColor;
      attribute float aBaseDot;
      attribute float aReveal;
      attribute vec2 aRestOffset;
      attribute vec3 aFlight;
      attribute float aPhase;
      uniform float uTime;
      uniform float uScatter;
      uniform vec2 uPointer;
      uniform float uDisturbance;
      uniform float uBrushRadius;
      uniform float uPointScale;
      uniform float uSpacing;
      uniform float uDetailScale;
      uniform vec3 uInk;
      varying float vOpacity;
      varying float vDiameter;
      varying vec3 vColor;
      void main() {
        vec2 away = position.xy - uPointer;
        float brush = (1.0 - smoothstep(0.0, uBrushRadius * uBrushRadius, dot(away, away))) * uDisturbance;
        float colorAmount = aReveal;
        float detail = smoothstep(0.02, 0.16, colorAmount);
        if (aBaseDot < 0.5 && detail < 0.002) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          gl_PointSize = 1.0;
          vOpacity = 0.0;
          vDiameter = 1.0;
          vColor = uInk;
          return;
        }
        vec3 p = position + aFlight * uScatter;
        p.xy += aRestOffset * (1.0 - colorAmount);
        float drift = sin(uTime * 2.4 + aPhase) * 0.002;
        p.xy += vec2(drift, drift * 0.6);
        vec2 flutter = vec2(cos(aPhase + uTime * 0.65), sin(aPhase * 1.3 + uTime * 0.55));
        p.xy += flutter * uSpacing * mix(1.1, 0.08, colorAmount) * colorAmount;
        p.xy += away / uBrushRadius * uSpacing * 0.3 * brush * (1.0 - colorAmount);
        p.z += brush * 0.06;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        float size = mix(aSize * aBaseDot, 1.15 * uDetailScale, colorAmount);
        vOpacity = mix(aOpacity * aBaseDot, 1.0, colorAmount) * (1.0 - min(uScatter, 1.0) * 0.15);
        vOpacity *= mix(detail, 1.0, aBaseDot);
        vDiameter = clamp(uSpacing * size * uPointScale, 0.8, 7.0);
        gl_PointSize = vDiameter + 1.0;
        vColor = mix(uInk, aColor, colorAmount);
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      varying float vDiameter;
      varying vec3 vColor;
      void main() {
        if (vOpacity < 0.002) discard;
        float distance = length(gl_PointCoord - 0.5) * (vDiameter + 1.0);
        float radius = vDiameter * 0.5;
        float alpha = (1.0 - smoothstep(max(0.0, radius - 0.5), radius + 0.5, distance)) * vOpacity;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(vColor, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const dots = new Points(geometry, material);
  dots.frustumCulled = false;
  dots.renderOrder = 2;
  portrait.add(dots);

  const photoTexture = new Texture(photo);
  photoTexture.colorSpace = SRGBColorSpace;
  photoTexture.needsUpdate = true;
  const photoGeometry = new PlaneGeometry(
    portraitWidth,
    portraitHeight,
    72,
    Math.round(baseRows / 2),
  );
  const vertices = photoGeometry.getAttribute('position');
  const uv = photoGeometry.getAttribute('uv');
  for (let index = 0; index < vertices.count; index++) {
    const x = Math.min(columns - 1, Math.floor(uv.getX(index) * columns));
    const y = Math.min(rows - 1, Math.floor((1 - uv.getY(index)) * rows));
    vertices.setZ(
      index,
      surfaceDepth(vertices.getX(index), vertices.getY(index), lightnessAt((y * columns + x) * 4)) -
        0.01,
    );
  }
  const photoMaterial = new ShaderMaterial({
    uniforms: { uScatter: uniforms.uScatter, uPhoto: { value: photoTexture } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uPhoto;
      uniform float uScatter;
      varying vec2 vUv;
      void main() {
        float reveal = smoothstep(0.08, 0.85, uScatter);
        if (reveal < 0.002) discard;
        vec4 photo = texture2D(uPhoto, vUv);
        gl_FragColor = vec4(photo.rgb, photo.a * reveal);
        #include <colorspace_fragment>
      }
    `,
  });
  const photoSurface = new Mesh(photoGeometry, photoMaterial);
  photoSurface.renderOrder = 1;
  photoSurface.visible = false;
  portrait.add(photoSurface);
  counter.textContent = new Intl.NumberFormat('en-US').format(pointCount);
  stage.dataset.pointCount = String(pointCount);
  stage.dataset.portraitState = 'dots';

  let width = 0;
  let height = 0;
  let frame = 0;
  let previousTime = 0;
  let elapsed = 0;
  let visible = false;
  let disposed = false;
  let contextLost = false;
  let scatter = 0;
  let scatterTarget = 0;
  let disturbance = 0;
  let lastBrush = -Infinity;
  let lastPointerTime = 0;
  let targetBrushRadius = minimumBrushRadius;
  let revealActive = false;
  let selectedPointCount = basePointCount;
  const pointerTarget = new Vector2(-10, -10);
  const previousBrush = new Vector2(-10, -10);
  const pointer = new Vector2();
  const raycaster = new Raycaster();
  const brushPlane = new Plane();
  const brushPoint = new Vector3();
  const forward = new Vector3(0, 0, 1);

  function clearReveal(): void {
    revealAttribute.array.fill(0);
    revealAttribute.clearUpdateRanges();
    revealAttribute.needsUpdate = true;
    revealPeaks.fill(0);
    revealTimes.fill(-Infinity);
    selectedPointCount = basePointCount;
    revealActive = false;
  }

  function updateReveal(time: number, delta: number): void {
    if (disturbance === 0) {
      if (revealActive) clearReveal();
      return;
    }
    revealActive = true;
    const brushPosition = uniforms.uPointer.value;
    const dx = brushPosition.x - previousBrush.x;
    const dy = brushPosition.y - previousBrush.y;
    const lengthSquared = dx * dx + dy * dy;
    const radius = uniforms.uBrushRadius.value;
    const radiusSquared = radius * radius;
    const left = Math.min(previousBrush.x, brushPosition.x) - radius;
    const right = Math.max(previousBrush.x, brushPosition.x) + radius;
    const bottom = Math.min(previousBrush.y, brushPosition.y) - radius;
    const top = Math.max(previousBrush.y, brushPosition.y) + radius;
    const inputFade = 1 - MathUtils.smoothstep(time - lastBrush, 500, 680);
    const ease = 1 - Math.exp(-delta * 9);
    let firstChanged = pointCount;
    let lastChanged = -1;
    let nextPointCount = basePointCount;
    let selectionChanged = false;

    for (let index = 0; index < pointCount; index++) {
      const x = positionAttribute.array[index * 3];
      const y = positionAttribute.array[index * 3 + 1];
      let target = revealPeaks[index]
        ? revealPeaks[index] * (1 - MathUtils.smoothstep(time - revealTimes[index], 500, 680))
        : 0;
      if (x >= left && x <= right && y >= bottom && y <= top) {
        const along = lengthSquared
          ? MathUtils.clamp(
              ((x - previousBrush.x) * dx + (y - previousBrush.y) * dy) / lengthSquared,
              0,
              1,
            )
          : 1;
        const offsetX = x - (previousBrush.x + dx * along);
        const offsetY = y - (previousBrush.y + dy * along);
        const distance =
          (offsetX * offsetX + offsetY * offsetY) / (radiusSquared * responseScales[index]);
        const influence = 1 - MathUtils.smoothstep(distance, 0, 1);
        if (influence * inputFade > target) {
          revealPeaks[index] = influence;
          // Age each dot from real input, not the render loop or a stationary cursor.
          revealTimes[index] = lastBrush;
          target = influence * inputFade;
        }
      }
      const current = revealAttribute.array[index];
      let next = Math.min(
        current + (target - current) * ease * (0.8 + responseScales[index] * 0.4),
        target,
      );
      if (next < 0.002) next = 0;
      if (Math.abs(next - current) > 0.0001 || (next === 0 && current !== 0)) {
        revealAttribute.array[index] = next;
        firstChanged = Math.min(firstChanged, index);
        lastChanged = index;
      }
      if (!baseDots[index] && revealAttribute.array[index] > 0.02) {
        if (drawIndices.array[nextPointCount] !== index) selectionChanged = true;
        drawIndices.array[nextPointCount++] = index;
      }
      if (target === 0) revealPeaks[index] = 0;
    }
    if (lastChanged >= firstChanged) {
      revealAttribute.clearUpdateRanges();
      revealAttribute.addUpdateRange(firstChanged, lastChanged - firstChanged + 1);
      revealAttribute.needsUpdate = true;
    }
    if (selectionChanged || nextPointCount !== selectedPointCount) {
      drawIndices.clearUpdateRanges();
      if (nextPointCount > basePointCount) {
        drawIndices.addUpdateRange(basePointCount, nextPointCount - basePointCount);
        drawIndices.needsUpdate = true;
      }
    }
    selectedPointCount = nextPointCount;
  }

  function render(): void {
    if (disposed || contextLost || !width || !height) return;
    // Brushing colors individual dots; only the scatter button uncovers the photo.
    photoSurface.visible = scatter > 0.001;
    geometry.setDrawRange(0, selectedPointCount);
    renderer.render(scene, camera);
    stage.classList.add('has-canvas');
  }

  function animate(time: number): void {
    frame = 0;
    if (disposed || contextLost || !visible || document.hidden) return;
    const moving = isMotionEnabled();
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.06) : 1 / 60;
    previousTime = time;
    if (moving) elapsed += delta;
    const ease = moving ? 1 - Math.exp(-delta * 6) : 1;
    scatter += (scatterTarget - scatter) * ease;
    if (Math.abs(scatterTarget - scatter) < 0.001) scatter = scatterTarget;
    const brushEase = 1 - Math.exp(-delta * 10);
    const fade = 1 - MathUtils.smoothstep(time - lastBrush, 500, 680);
    disturbance = moving ? Math.min(disturbance + (1 - disturbance) * brushEase, fade) : 0;
    if (disturbance < 0.002) disturbance = 0;
    if (disturbance === 0) {
      uniforms.uBrushRadius.value = minimumBrushRadius;
      targetBrushRadius = minimumBrushRadius;
    } else if (uniforms.uBrushRadius.value !== targetBrushRadius) {
      const difference = targetBrushRadius - uniforms.uBrushRadius.value;
      uniforms.uBrushRadius.value =
        Math.abs(difference) < 0.0001
          ? targetBrushRadius
          : uniforms.uBrushRadius.value + difference * brushEase;
    }
    const easedPointer = uniforms.uPointer.value;
    previousBrush.copy(easedPointer);
    if (disturbance > 0 && !easedPointer.equals(pointerTarget)) {
      if (easedPointer.distanceToSquared(pointerTarget) < 0.000001) {
        easedPointer.copy(pointerTarget);
      } else {
        easedPointer.lerp(pointerTarget, 1 - Math.exp(-delta * 16));
      }
    }
    updateReveal(time, delta);
    uniforms.uTime.value = moving ? elapsed : 0;
    uniforms.uScatter.value = scatter;
    uniforms.uDisturbance.value = disturbance;
    render();
    if (moving) frame = requestAnimationFrame(animate);
  }

  function schedule(): void {
    if (frame || disposed || contextLost || !visible || document.hidden) return;
    previousTime = 0;
    frame = requestAnimationFrame(animate);
  }

  function resize(): void {
    const rect = stage.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (!width || !height) return;
    const compact = window.innerWidth <= 760;
    const aspect = width / height;
    const viewHeight = Math.max(
      portraitHeight / (compact ? 0.6 : 0.8),
      portraitWidth / (aspect * (compact ? 0.94 : 0.66)),
    );
    const viewWidth = viewHeight * aspect;
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    portrait.position.set(
      compact ? 0 : viewWidth * 0.115,
      viewHeight * (compact ? 0.06 : 0.045),
      0,
    );
    uniforms.uPointScale.value = (height * dpr) / viewHeight;
    render();
    schedule();
  }

  function onPointerMove(event: PointerEvent): void {
    if (!isMotionEnabled() || contextLost) return;
    if (event.target instanceof Element && event.target.closest('button')) {
      onPointerLeave();
      return;
    }
    const rect = stage.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((event.clientY - rect.top) / rect.height) * 2;
    const distance = Math.hypot(
      ((x - pointer.x) * rect.width) / 2,
      ((y - pointer.y) * rect.height) / 2,
    );
    if (lastPointerTime && distance < 0.75 && event.type !== 'pointerdown') return;
    const time = performance.now();
    const seconds = MathUtils.clamp((time - lastPointerTime) / 1000, 0.001, 0.1);
    const speed =
      lastPointerTime && event.type !== 'pointerdown'
        ? distance / seconds / Math.min(rect.width, rect.height)
        : 0;
    pointer.set(x, y);
    portrait.updateMatrixWorld();
    brushPlane.set(forward, 0).applyMatrix4(portrait.matrixWorld);
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(brushPlane, brushPoint)) return;
    portrait.worldToLocal(brushPoint);
    pointerTarget.set(brushPoint.x, brushPoint.y);
    if (disturbance === 0 || lastPointerTime === 0) {
      uniforms.uPointer.value.copy(pointerTarget);
      previousBrush.copy(pointerTarget);
    }
    targetBrushRadius = MathUtils.lerp(
      minimumBrushRadius,
      maximumBrushRadius,
      MathUtils.clamp(speed / 2, 0, 1),
    );
    lastBrush = time;
    lastPointerTime = time;
    schedule();
  }

  function onPointerLeave(): void {
    lastPointerTime = 0;
  }

  function resetBrush(): void {
    lastBrush = -Infinity;
    lastPointerTime = 0;
    disturbance = 0;
    uniforms.uDisturbance.value = 0;
    uniforms.uBrushRadius.value = minimumBrushRadius;
    targetBrushRadius = minimumBrushRadius;
    pointerTarget.copy(uniforms.uPointer.value);
    previousBrush.copy(pointerTarget);
    clearReveal();
  }

  function onScatter(): void {
    if (contextLost) return;
    const scattered = scatterTarget === 0;
    scatterTarget = scattered ? 1.2 : 0;
    resetBrush();
    actionLabel.textContent = scattered ? 'Bring back the dots' : 'Scatter the dots';
    scatterButton.setAttribute('aria-pressed', String(scattered));
    stage.dataset.portraitState = scattered ? 'scattered' : 'dots';
    portraitStatus.textContent = scattered
      ? 'The dots have moved aside to reveal my original photo, with its background removed. Bring back the dots to cover it again.'
      : 'The single-color dots are back. Brush or touch them to bring out their original colors.';
    if (isMotionEnabled()) schedule();
    else {
      scatter = scatterTarget;
      uniforms.uScatter.value = scatter;
      render();
    }
  }

  function onMotionChange(): void {
    cancelAnimationFrame(frame);
    frame = 0;
    scatterButton.disabled = contextLost;
    if (!isMotionEnabled()) {
      scatter = scatterTarget;
      resetBrush();
      uniforms.uScatter.value = scatter;
      uniforms.uTime.value = 0;
      portrait.rotation.set(0, 0, 0);
      render();
    } else schedule();
  }

  function onVisibilityChange(): void {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      resetBrush();
    } else schedule();
  }

  function onContextLost(event: Event): void {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    stage.classList.remove('has-canvas');
    scatterButton.disabled = true;
    portraitStatus.textContent =
      'Graphics were interrupted. A static, dots-only portrait is shown instead.';
    portraitStatus.classList.remove('sr-only');
  }

  function onContextRestored(): void {
    contextLost = false;
    resetBrush();
    portraitStatus.textContent =
      'The interactive portrait is available again. Brush the dots into color, or scatter them to reveal my photo.';
    portraitStatus.classList.add('sr-only');
    resize();
    onMotionChange();
  }

  const resizeObserver = new ResizeObserver(resize);
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
        resetBrush();
      }
    },
    { threshold: 0 },
  );
  resizeObserver.observe(stage);
  visibilityObserver.observe(stage);
  stage.addEventListener('pointermove', onPointerMove, { passive: true });
  stage.addEventListener('pointerdown', onPointerMove, { passive: true });
  stage.addEventListener('pointerleave', onPointerLeave);
  stage.addEventListener('pointercancel', onPointerLeave);
  scatterButton.addEventListener('click', onScatter);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  window.addEventListener('portfolio:motion', onMotionChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  scatterButton.disabled = false;
  portraitStatus.textContent =
    'A single-color dot portrait. Brush gently to let individual dots drift into color, or sweep faster to reveal more. Each dot briefly remembers your movement, then fades even if you keep the pointer still. Scatter the dots to see the full photograph.';
  resize();

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerdown', onPointerMove);
      stage.removeEventListener('pointerleave', onPointerLeave);
      stage.removeEventListener('pointercancel', onPointerLeave);
      scatterButton.removeEventListener('click', onScatter);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      window.removeEventListener('portfolio:motion', onMotionChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      geometry.dispose();
      material.dispose();
      photoGeometry.dispose();
      photoMaterial.dispose();
      photoTexture.dispose();
      renderer.dispose();
    },
  };
}
