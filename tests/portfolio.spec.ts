import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';

declare global {
  interface Window {
    portfolioPortraitDraws: { triangles: number; points: number };
    portfolioHintAnimations: string[];
    portfolioChannelStatic: {
      durations: (number | string)[];
      samples: { time: number; progress: number | null; transform: string; opacity: number }[];
      pauseNext: boolean;
    };
  }
}

async function loadPortfolio(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.project-card')).toHaveCount(5);
  await page.evaluate(() => document.fonts.ready);
}

async function loadPortrait(page: Page): Promise<void> {
  await loadPortfolio(page);
  await page.locator('#playground-stage').scrollIntoViewIfNeeded();
  await expect(page.locator('#playground-stage')).toHaveClass(/has-canvas/);
  await page.mouse.move(0, 0);
}

async function portraitColorRatio(page: Page, screenshotPath?: string): Promise<number> {
  const screenshot = await page.locator('#playground-canvas').screenshot({ path: screenshotPath });
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const compact = window.innerWidth <= 760;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * 0.26);
    canvas.height = Math.round(image.naturalHeight * 0.3);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The portrait screenshot could not be sampled.');
    context.drawImage(
      image,
      -image.naturalWidth * (compact ? 0.4 : 0.53),
      -image.naturalHeight * (compact ? 0.25 : 0.21),
    );
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let photographic = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] - pixels[i + 1] > 27 && pixels[i + 1] - pixels[i + 2] > 15) {
        photographic++;
      }
    }
    return photographic / (canvas.width * canvas.height);
  }, screenshot.toString('base64'));
}

async function sweepPortrait(
  page: Page,
  point: { x: number; y: number },
  mobile: boolean,
): Promise<void> {
  await page.evaluate(
    async ({ point, mobile }) => {
      const stage = document.getElementById('playground-stage');
      if (!stage) throw new Error('The portrait is unavailable for the brush gesture.');
      const bounds = stage.getBoundingClientRect();
      const amplitude = Math.min(bounds.width, bounds.height) * 0.04;
      const move = (x: number) =>
        stage.dispatchEvent(
          new PointerEvent('pointermove', {
            pointerType: mobile ? 'touch' : 'mouse',
            clientX: x,
            clientY: point.y,
          }),
        );
      for (let frame = 0; frame < 16; frame++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        move(point.x + (frame % 2 ? amplitude : -amplitude));
      }
      move(point.x);
    },
    { point, mobile },
  );
}

test('loads a complete, local-only portfolio with a live 3D terminal', async ({ page }) => {
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4177')) externalRequests.push(request.url());
  });
  await loadPortfolio(page);
  await expect(page).toHaveTitle('Eesha Kavuri — Engineer. Builder. Dot connector.');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('EESHA');
  await expect(page.locator('#hero-art')).toHaveClass(/has-webgl/);
  await expect(page.locator('#art-status')).toBeEmpty();
  await expect(page.getByRole('link', { name: 'The full story, on paper' })).toBeVisible();
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test('terminal channels change the artwork and open the correct project', async ({ page }) => {
  await loadPortfolio(page);
  await expect(page.locator('#hero-art')).toHaveClass(/has-webgl/);
  const canvas = page.locator('#machine-canvas canvas');
  await expect(page.locator('#machine-canvas')).toHaveAttribute('data-displayed-project', 'enghub');
  const initial = await canvas.screenshot();
  await page.getByRole('button', { name: 'Next featured project' }).click();
  await expect(page.locator('#featured-label')).toContainText('SKETCHBOOKLM');
  await expect(page.locator('#hero-art')).toHaveAttribute('data-featured-project', 'sketchbook');
  await expect(page.locator('#machine-canvas')).toHaveAttribute(
    'data-displayed-project',
    'sketchbook',
  );
  await expect.poll(async () => Buffer.compare(await canvas.screenshot(), initial)).not.toBe(0);
  await page.getByRole('button', { name: 'Explore featured project: SketchbookLM' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#dialog-title')).toHaveText('SketchbookLM');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Previous featured project' }).click();
  await page.getByRole('button', { name: 'Previous featured project' }).click();
  await expect(page.locator('#featured-label')).toContainText('RAISETHEBAR');
  await page.getByRole('button', { name: 'Next featured project' }).click();
  await expect(page.locator('#featured-label')).toContainText('ENGHUB GET RIGHT');
  for (const [number, id, name] of [
    ['02', 'sketchbook', 'SketchbookLM'],
    ['03', 'transfer', 'File Transfer Service'],
    ['04', 'ainews', 'AI/NEWS'],
    ['05', 'raisethebar', 'RaiseTheBar'],
    ['01', 'enghub', 'EngHub Get Right'],
  ]) {
    await page.getByRole('button', { name: 'Next featured project' }).click();
    await expect(page.locator('#featured-label')).toContainText(`${number} / 05`);
    await expect(page.locator('#machine-canvas')).toHaveAttribute('data-displayed-project', id);
    await expect(page.locator('#terminal-artwork')).toHaveAttribute('src', `./images/${id}.svg`);
    await page.getByRole('button', { name: `Explore featured project: ${name}` }).click();
    await expect(page.locator('#dialog-title')).toHaveText(name);
    await page.keyboard.press('Escape');
  }
  await expect(page.locator('#terminal-hint')).not.toBeVisible();
});

test('TV controls sit on the right bezel and the computer stays fixed', async ({
  page,
}, testInfo) => {
  await loadPortfolio(page);
  await expect(page.locator('#hero-art')).toHaveClass(/has-webgl/);
  await expect(page.locator('#machine-canvas')).toHaveAttribute('data-displayed-project', 'enghub');
  await expect(page.getByRole('button', { name: /different perspective/i })).toHaveCount(0);
  const bounds = await page.locator('#terminal-controls > button').evaluateAll((buttons) => {
    const screen = document.getElementById('featured-open')?.getBoundingClientRect();
    if (!screen) throw new Error('Missing terminal screen.');
    return buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        rightOfScreen: rect.left >= screen.right,
        withinScreenHeight: rect.top >= screen.top && rect.bottom <= screen.bottom,
        size: Math.min(rect.width, rect.height),
        hit: button.contains(
          document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
        ),
      };
    });
  });
  for (const button of bounds) {
    expect(button.rightOfScreen).toBe(true);
    expect(button.withinScreenHeight).toBe(true);
    expect(button.size).toBeGreaterThanOrEqual(24);
    expect(button.hit).toBe(true);
  }
  await page.locator('#featured-next').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#machine-canvas')).toHaveAttribute(
    'data-displayed-project',
    'sketchbook',
  );
  await expect(page.locator('#terminal-hint')).not.toBeVisible();
  await expect(page.locator('#machine-canvas')).toHaveAttribute('data-channel-state', 'ready');
  const canvas = page.locator('#machine-canvas canvas');
  const screenshotOptions = {
    animations: 'disabled',
    style:
      '.hero-stamp, .menu-toggle, .terminal-controls, .terminal-open, .terminal-hint { visibility: hidden !important; }',
  } as const;
  const pose = await canvas.screenshot(screenshotOptions);
  await page.mouse.move(100, 150);
  await page.mouse.move(300, 450, { steps: 5 });
  const moved = await canvas.screenshot(screenshotOptions);
  await testInfo.attach('terminal-before', { body: pose, contentType: 'image/png' });
  await testInfo.attach('terminal-after', { body: moved, contentType: 'image/png' });
  expect(Buffer.compare(moved, pose)).toBe(0);
});

test('the channel discovery bubble pops up and disappears without requiring a click', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    window.portfolioHintAnimations = [];
    document.addEventListener('animationstart', (event) => {
      if (event.target instanceof Element && event.target.id === 'terminal-hint') {
        window.portfolioHintAnimations.push(event.animationName);
      }
    });
  });
  await loadPortfolio(page);
  const hint = page.locator('#terminal-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('Try out the channels');
  await expect
    .poll(() => page.evaluate(() => window.portfolioHintAnimations))
    .toContain('channel-hint-pop');
  await expect
    .poll(() => hint.evaluate((element) => Number(getComputedStyle(element).opacity)))
    .toBeGreaterThan(0.98);
  await page.screenshot({ path: `artifacts\\${testInfo.project.name}-channel-hint.png` });
  await expect(hint).not.toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#featured-next')).toBeVisible();
});

test('channel changes show brief screen-only TV static and respect motion off', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    window.portfolioChannelStatic = { durations: [], samples: [], pauseNext: false };
    const original = Element.prototype.animate;
    Element.prototype.animate = function (
      keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
      options?: number | KeyframeAnimationOptions,
    ) {
      const animation = original.call(this, keyframes, options);
      if (this.classList.contains('terminal-static')) {
        const grain = this.firstElementChild;
        if (!grain || !animation.effect) throw new Error('The TV-static animation is incomplete.');
        const state = window.portfolioChannelStatic;
        state.durations.push(animation.effect.getTiming().duration);
        const sample = (time: number) => {
          state.samples.push({
            time,
            progress: animation.effect?.getComputedTiming().progress ?? null,
            transform: getComputedStyle(grain).transform,
            opacity: Number(getComputedStyle(this).opacity),
          });
          if (animation.playState === 'running') requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
        if (state.pauseNext) {
          state.pauseNext = false;
          for (const effect of this.getAnimations({ subtree: true })) {
            effect.pause();
            effect.currentTime = 80;
          }
        }
      }
      return animation;
    };
  });
  await loadPortfolio(page);
  const terminal = page.locator('#machine-canvas');
  const staticLayer = page.locator('.terminal-static');
  await expect(terminal).toHaveAttribute('data-displayed-project', 'enghub');
  await expect(terminal).toHaveAttribute('data-channel-state', 'ready');
  expect(await page.evaluate(() => window.portfolioChannelStatic.durations)).toEqual([]);
  await page.getByRole('button', { name: 'Next featured project' }).click();
  await expect
    .poll(() => page.evaluate(() => window.portfolioChannelStatic.durations))
    .toEqual([220]);
  await expect(terminal).toHaveAttribute('data-channel-state', 'ready');
  const recording = await page.evaluate(() => window.portfolioChannelStatic);
  const active = recording.samples.filter(
    (sample) => sample.progress !== null && sample.progress > 0,
  );
  expect(active.length).toBeGreaterThan(2);
  expect(new Set(active.map((sample) => sample.transform)).size).toBeGreaterThan(2);
  expect(active.at(-1)!.time - active[0].time).toBeLessThan(400);
  expect(active.some((sample) => sample.opacity > 0 && sample.opacity < 0.9)).toBe(true);
  await expect(staticLayer).not.toBeVisible();
  expect(
    await staticLayer.evaluate((element) => element.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await testInfo.attach('tv-static-motion', {
    body: JSON.stringify(recording, null, 2),
    contentType: 'application/json',
  });

  const clip = await page.locator('#machine-canvas canvas').evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const x = Math.max(0, Math.ceil(bounds.left));
    const y = Math.max(0, Math.ceil(bounds.top));
    return {
      x,
      y,
      width: Math.min(window.innerWidth, Math.floor(bounds.right)) - x,
      height: Math.min(window.innerHeight, Math.floor(bounds.bottom)) - y,
    };
  });
  const screenOnly = {
    clip,
    style:
      '.hero-stamp, .terminal-controls, .terminal-hint, .terminal-caption { visibility: hidden !important; }',
  };
  const baseline = await page.screenshot(screenOnly);
  await page.evaluate(() => {
    window.portfolioChannelStatic.pauseNext = true;
  });
  await page.getByRole('button', { name: 'Previous featured project' }).click();
  await expect(terminal).toHaveAttribute('data-displayed-project', 'enghub');
  await expect(terminal).toHaveAttribute('data-channel-state', 'static');
  await expect(staticLayer).toBeVisible();
  const capture = await page.screenshot({
    ...screenOnly,
    path: `artifacts\\${testInfo.project.name}-terminal-static.png`,
  });
  await testInfo.attach('terminal-before-static', { body: baseline, contentType: 'image/png' });
  await testInfo.attach('terminal-during-static', { body: capture, contentType: 'image/png' });
  const footprint = await page.evaluate(
    async ({ baseline, capture, clip }) => {
      const before = new Image();
      const during = new Image();
      before.src = `data:image/png;base64,${baseline}`;
      during.src = `data:image/png;base64,${capture}`;
      await Promise.all([before.decode(), during.decode()]);
      if (before.width !== during.width || before.height !== during.height) {
        throw new Error('The terminal changed dimensions during its static transition.');
      }
      const canvas = document.createElement('canvas');
      canvas.width = before.width;
      canvas.height = before.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('The TV-static frames could not be sampled.');
      context.drawImage(before, 0, 0);
      const original = context.getImageData(0, 0, canvas.width, canvas.height).data;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(during, 0, 0);
      const current = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const screen = document.getElementById('featured-open')?.getBoundingClientRect();
      if (!screen) throw new Error('The TV screen bounds are unavailable.');
      const scale = canvas.width / clip.width;
      const left = (screen.left - clip.x) * scale;
      const top = (screen.top - clip.y) * scale;
      const right = (screen.right - clip.x) * scale;
      const bottom = (screen.bottom - clip.y) * scale;
      let outside = 0;
      let changedOutside = 0;
      let center = 0;
      let grayCenter = 0;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const offset = (y * canvas.width + x) * 4;
          if (x < left - 3 || x > right + 3 || y < top - 3 || y > bottom + 3) {
            outside++;
            const difference = [0, 1, 2, 3].reduce(
              (sum, channel) =>
                sum + Math.abs(original[offset + channel] - current[offset + channel]),
              0,
            );
            if (difference > 12) changedOutside++;
          }
          if (
            x > left + (right - left) * 0.2 &&
            x < right - (right - left) * 0.2 &&
            y > top + (bottom - top) * 0.2 &&
            y < bottom - (bottom - top) * 0.2
          ) {
            center++;
            if (
              current[offset + 3] > 240 &&
              Math.abs(current[offset] - current[offset + 1]) < 8 &&
              Math.abs(current[offset + 1] - current[offset + 2]) < 8
            ) {
              grayCenter++;
            }
          }
        }
      }
      return { changedOutside: changedOutside / outside, grayCenter: grayCenter / center };
    },
    { baseline: baseline.toString('base64'), capture: capture.toString('base64'), clip },
  );
  expect(footprint.changedOutside).toBeLessThan(0.001);
  expect(footprint.grayCenter).toBeGreaterThan(0.8);
  await staticLayer.evaluate((element) => {
    for (const animation of element.getAnimations({ subtree: true })) animation.play();
  });
  await expect(terminal).toHaveAttribute('data-channel-state', 'ready');
  await expect(staticLayer).not.toBeVisible();

  await page.getByRole('button', { name: 'Pause animations' }).click();
  await loadPortfolio(page);
  await expect(page.getByRole('button', { name: 'Resume animations' })).toBeVisible();
  await expect(page.locator('#terminal-hint')).toHaveCSS('opacity', '1');
  await expect(page.locator('#terminal-hint')).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Next featured project' }).click();
  await expect(terminal).toHaveAttribute('data-displayed-project', 'sketchbook');
  await expect(terminal).toHaveAttribute('data-channel-state', 'ready');
  expect(await page.evaluate(() => window.portfolioChannelStatic.durations)).toEqual([]);
  await page.getByRole('button', { name: 'Resume animations' }).click();
  await page.evaluate(() => {
    window.portfolioChannelStatic.pauseNext = true;
  });
  await page.getByRole('button', { name: 'Next featured project' }).click();
  await expect(terminal).toHaveAttribute('data-channel-state', 'static');
  await page.getByRole('button', { name: 'Pause animations' }).click();
  await expect(terminal).toHaveAttribute('data-channel-state', 'ready');
  await expect(staticLayer).not.toBeVisible();
  await page.waitForTimeout(260);
  expect(
    await staticLayer.evaluate((element) => element.getAnimations({ subtree: true }).length),
  ).toBe(0);
});

test('cold loads and refreshes show only the finished terminal and keep its channel hint', async ({
  page,
}) => {
  let releaseMachine: () => void = () => {};
  let machineDownload: Promise<void>;
  await page.route(/\/assets\/machine-[^/]+\.js$/, async (route) => {
    await machineDownload;
    await route.continue();
  });
  for (const refresh of [false, true]) {
    machineDownload = new Promise<void>((resolve) => {
      releaseMachine = resolve;
    });
    try {
      if (refresh) await page.reload({ waitUntil: 'domcontentloaded' });
      else await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.project-card')).toHaveCount(5);
      await expect(page.locator('#hero-art')).toHaveAttribute('data-terminal-state', 'loading');
      await expect(page.locator('.machine-fallback')).not.toBeVisible();
      await expect(page.locator('#featured-open')).not.toBeVisible();
      await expect(page.locator('#terminal-hint')).not.toBeVisible();
      expect(
        await page.locator('.site-header').evaluate((header) => {
          return Number.parseFloat(getComputedStyle(header).paddingLeft);
        }),
      ).toBeGreaterThanOrEqual(23);
      if (!refresh) await page.waitForTimeout(7200);
      releaseMachine();
      await expect(page.locator('#hero-art')).toHaveAttribute('data-terminal-state', 'ready');
      await expect(page.locator('#machine-canvas')).toHaveAttribute(
        'data-displayed-project',
        'enghub',
      );
      await expect(page.locator('#terminal-hint')).toBeVisible();
      await expect(page.locator('.machine-fallback')).not.toBeVisible();
      await page.getByRole('button', { name: 'Next featured project' }).click();
      await expect(page.locator('#featured-label')).toContainText('SKETCHBOOKLM');
      await expect(page.locator('#terminal-hint')).not.toBeVisible();
    } finally {
      releaseMachine();
    }
  }
});

test('the terminal waits for its first project artwork instead of flashing a loading screen', async ({
  page,
}) => {
  let releaseArtwork: () => void = () => {};
  const artworkDownload = new Promise<void>((resolve) => {
    releaseArtwork = resolve;
  });
  await page.route('**/images/enghub.svg', async (route) => {
    await artworkDownload;
    await route.continue();
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#machine-canvas canvas')).toHaveCount(1);
    await expect(page.locator('#hero-art')).toHaveAttribute('data-terminal-state', 'loading');
    await expect(page.locator('#machine-canvas canvas')).not.toBeVisible();
    await expect(page.locator('.machine-fallback')).not.toBeVisible();
    await expect(page.locator('#terminal-hint')).not.toBeVisible();
    releaseArtwork();
    await expect(page.locator('#hero-art')).toHaveAttribute('data-terminal-state', 'ready');
    await expect(page.locator('#machine-canvas')).toHaveAttribute(
      'data-displayed-project',
      'enghub',
    );
    await expect(page.locator('#machine-canvas canvas')).toBeVisible();
    await expect(page.locator('#terminal-hint')).toBeVisible();
  } finally {
    releaseArtwork();
  }
});

test('the ticker continuously repeats every phrase without an empty tail or loop jump', async ({
  page,
}) => {
  await loadPortfolio(page);
  for (const width of [320, 390, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    const loop = await page.locator('.ticker-track').evaluate((track) => {
      const ticker = track.parentElement;
      const groups = track.querySelectorAll<HTMLElement>('.ticker-group');
      const animation = track.getAnimations()[0];
      if (!ticker || groups.length !== 2 || !animation) {
        throw new Error('The continuous ticker is missing its repeated groups or animation.');
      }
      animation.pause();
      const duration = Number(animation.effect?.getTiming().duration);
      const viewport = ticker.getBoundingClientRect();
      const covered = [0, 0.2, 0.5, 0.8, 0.999, 1, 1.2].map((progress) => {
        animation.currentTime = duration * progress;
        const first = groups[0].getBoundingClientRect();
        const second = groups[1].getBoundingClientRect();
        return (
          first.left <= viewport.left + 1 &&
          second.right >= viewport.right - 1 &&
          Math.abs(first.right - second.left) < 1
        );
      });
      animation.currentTime = duration * 0.99;
      const returningPhrase = groups[1].querySelector('span')?.getBoundingClientRect();
      animation.currentTime = 0;
      const start = groups[0].getBoundingClientRect().left;
      animation.currentTime = duration;
      return {
        groupWidth: groups[0].getBoundingClientRect().width,
        viewportWidth: viewport.width,
        phrases: Array.from(groups, (group) =>
          Array.from(group.querySelectorAll('span'), (span) => span.textContent),
        ),
        covered,
        returns: Boolean(
          returningPhrase &&
          returningPhrase.left < viewport.right &&
          returningPhrase.right > viewport.left,
        ),
        loopShift: Math.abs(groups[0].getBoundingClientRect().left - start),
        visiblePhrases: Array.from(track.querySelectorAll('span')).filter((span) => {
          const rect = span.getBoundingClientRect();
          return rect.left >= viewport.left && rect.right <= viewport.right;
        }).length,
      };
    });
    expect(loop.groupWidth).toBeGreaterThanOrEqual(loop.viewportWidth - 1);
    expect(loop.phrases[0]).toEqual([
      'THOUGHTFUL BY DESIGN',
      'BUILT TO MAKE A DIFFERENCE',
      'CURIOUS BY DEFAULT',
      'BUILT WITH INTENTION',
      'ALWAYS EXPLORING',
    ]);
    expect(loop.phrases[1]).toEqual(loop.phrases[0]);
    expect(loop.covered.every(Boolean), `Ticker coverage at ${width}px`).toBe(true);
    expect(loop.returns, `First phrase returns at ${width}px`).toBe(true);
    expect(loop.loopShift).toBeLessThan(1);
    if (width >= 1440) {
      expect(loop.visiblePhrases).toBeGreaterThanOrEqual(4);
      expect(loop.visiblePhrases).toBeLessThanOrEqual(5);
    }
  }
});

test('all five cards and their actual artwork share the same dimensions', async ({ page }) => {
  await loadPortfolio(page);
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const sizes = await page.locator('.project-card').evaluateAll(async (cards) => {
      return Promise.all(
        cards.map(async (card) => {
          const image = card.querySelector('img');
          if (!image) throw new Error('A project has no artwork.');
          image.loading = 'eager';
          await image.decode();
          const rect = card.getBoundingClientRect();
          const artwork = image.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            imageRatio: artwork.width / artwork.height,
            sourceRatio: image.naturalWidth / image.naturalHeight,
          };
        }),
      );
    });
    for (const card of sizes) {
      expect(Math.abs(card.width - sizes[0].width), `Card width at ${width}px`).toBeLessThan(1);
      expect(Math.abs(card.height - sizes[0].height), `Card height at ${width}px`).toBeLessThan(1);
      expect(card.imageRatio).toBeCloseTo(4 / 3, 2);
      expect(card.sourceRatio).toBeCloseTo(4 / 3, 2);
    }
  }
});

test('filters selected work without losing project details', async ({ page }) => {
  await loadPortfolio(page);
  await page.getByRole('button', { name: 'Systems 02' }).click();
  await expect(page.locator('.project-card')).toHaveCount(2);
  await expect(page.locator('#work-status')).toHaveText('Showing 2 systems projects.');
  await expect(page.getByRole('button', { name: 'Systems 02' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Explore File Transfer Service', exact: true }).click();
  await expect(page.locator('#dialog-title')).toHaveText('File Transfer Service');
  await expect(page.locator('.dialog-outcome')).toContainText('75%');
  await page.getByRole('button', { name: 'Close project' }).click();
  await page.getByRole('button', { name: 'AI & ideas 03' }).click();
  await expect(page.locator('.project-card')).toHaveCount(3);
  await expect(page.locator('.project-card[data-project="enghub"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'All 05' }).click();
  await expect(page.locator('.project-card')).toHaveCount(5);
});

test('every project has a working, keyboard-accessible case study', async ({ page }) => {
  await loadPortfolio(page);
  for (const name of [
    'EngHub Get Right',
    'SketchbookLM',
    'File Transfer Service',
    'AI/NEWS',
    'RaiseTheBar',
  ]) {
    const button = page.getByRole('button', { name: `Explore ${name}`, exact: true });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#dialog-title')).toHaveText(name);
    await expect(page.locator('.dialog-detail')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Close project' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.dialog-contact')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Close project' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(button).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  }
});

test('the editorial case studies retain every project and fit the viewport', async ({
  page,
}, testInfo) => {
  await loadPortfolio(page);
  for (const id of ['enghub', 'sketchbook', 'transfer', 'ainews', 'raisethebar']) {
    await page.locator(`.project-card[data-project="${id}"] .project-hit`).click();
    await expect(page.locator('#project-dialog')).toHaveAttribute('data-project', id);
    await expect(page.locator('.dialog-hero')).toBeVisible();
    await expect(page.locator('.dialog-hook')).not.toBeEmpty();
    await expect(page.locator('.dialog-outcome')).toContainText('THE TAKEAWAY');
    await expect(page.locator('.dialog-detail')).toHaveCount(3);
    const layout = await page.locator('#project-dialog').evaluate(async (element) => {
      const image = element.querySelector<HTMLImageElement>('.dialog-image');
      if (!image) throw new Error('The case study has no concept artwork.');
      await image.decode();
      const imageStyle = getComputedStyle(image);
      return {
        overflow: element.scrollWidth - element.clientWidth,
        imageRatio: Number.parseFloat(imageStyle.width) / Number.parseFloat(imageStyle.height),
      };
    });
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.imageRatio).toBeCloseTo(4 / 3, 2);
    if (id === 'enghub') {
      await page.screenshot({ path: `artifacts\\${testInfo.project.name}-case-cover.png` });
      await page.locator('.dialog-contact').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `artifacts\\${testInfo.project.name}-case-story.png` });
    }
    await page.keyboard.press('Escape');
  }
});

test('both Microsoft career symbols use the upright four-color logo', async ({ page }) => {
  await loadPortfolio(page);
  await expect(page.locator('.microsoft-mark')).toHaveCount(2);
  const marks = await page.locator('.microsoft-mark').evaluateAll((logos) =>
    logos.map((logo) => ({
      transform: getComputedStyle(logo).transform,
      colors: Array.from(logo.children, (square) => getComputedStyle(square).backgroundColor),
    })),
  );
  for (const mark of marks) {
    expect(mark.transform).toBe('none');
    expect(mark.colors).toEqual([
      'rgb(242, 80, 34)',
      'rgb(127, 186, 0)',
      'rgb(0, 164, 239)',
      'rgb(255, 185, 0)',
    ]);
  }
});

test('navigation works at desktop and mobile sizes', async ({ page }, testInfo) => {
  await loadPortfolio(page);
  const mobile = testInfo.project.name === 'mobile';
  if (mobile) {
    await expect(page.locator('#main-navigation')).not.toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  }
  await page.locator('#main-navigation').getByRole('link', { name: '02 About' }).click();
  await expect(page).toHaveURL(/#about$/);
  await expect
    .poll(() => page.locator('#about').evaluate((element) => element.getBoundingClientRect().top))
    .toBeLessThan(125);
  if (mobile) {
    await expect(page.locator('#main-navigation')).not.toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
    await expect(page.locator('#main-navigation')).not.toBeVisible();
  }
});

test('experience expands and preserves the resume dates', async ({ page }) => {
  await loadPortfolio(page);
  const ibm = page.locator('details').filter({ hasText: 'IBM' });
  await ibm.locator('summary').click();
  await expect(ibm).toHaveAttribute('open', '');
  await expect(ibm).toContainText('Jan 2026 - Jun 2026');
  await expect(ibm).toContainText('COBOL copybooks');
  await ibm.locator('summary').click();
  await expect(ibm).not.toHaveAttribute('open', '');
  await expect(page.locator('.experience-item.current')).toHaveAttribute('open', '');
  await expect(page.locator('.experience-item.current')).toContainText('Jul 2024 - Present');
  await expect(page.locator('.experience-item')).toHaveCount(3);
  await expect(page.locator('.education-score > strong')).toHaveText('9.3');
  await expect(page.locator('.education-score')).toContainText('CGPA');
});

test('motion starts on and an explicit off choice persists across visits', async ({ page }) => {
  await loadPortfolio(page);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Pause animations' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  expect(await page.evaluate(() => localStorage.getItem('portfolio:motion'))).toBe('off');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume animations' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.getByRole('button', { name: 'Resume animations' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
});

test('blocked preference storage still permits pausing and reports the limitation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem']) {
      Object.defineProperty(Storage.prototype, method, {
        value() {
          throw new DOMException('Storage is disabled', 'SecurityError');
        },
      });
    }
  });
  await loadPortfolio(page);
  await expect(page.locator('#motion-status')).toContainText('cannot be saved');
  await page.getByRole('button', { name: 'Pause animations' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await expect(page.locator('#motion-status')).toContainText('could not save');
});

test('introductory and background text stays legible and visible on mobile', async ({ page }) => {
  await loadPortfolio(page);
  for (const selector of [
    '.hero-description > p:not(.art-status)',
    '.about-copy > p',
    '.experience-details',
  ]) {
    const styles = await page.locator(selector).evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return {
          size: parseFloat(style.fontSize),
          display: style.display,
          visibility: style.visibility,
        };
      }),
    );
    for (const style of styles) {
      expect(style.size).toBeGreaterThanOrEqual(16);
      expect(style.display).not.toBe('none');
      expect(style.visibility).not.toBe('hidden');
    }
  }
});

test('the selected portrait cutout preserves photo color and removes the background', async ({
  page,
}) => {
  await loadPortfolio(page);
  const image = await page.evaluate(async () => {
    const photo = new Image();
    photo.src = './images/eesha-portrait.webp';
    await photo.decode();
    const canvas = document.createElement('canvas');
    canvas.width = photo.naturalWidth;
    canvas.height = photo.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The cutout could not be inspected.');
    context.drawImage(photo, 0, 0);
    const sample = (x: number, y: number): number[] =>
      Array.from(
        context.getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1)
          .data,
      );
    return {
      width: photo.naturalWidth,
      height: photo.naturalHeight,
      corners: [
        [0.05, 0.05],
        [0.95, 0.05],
        [0.08, 0.55],
        [0.95, 0.3],
        [0.98, 0.8],
      ].map(([x, y]) => sample(x, y)),
      face: sample(0.52, 0.44),
    };
  });
  expect([image.width, image.height]).toEqual([1486, 1173]);
  expect(image.corners.every((pixel) => pixel[3] === 0)).toBe(true);
  expect(image.face[3]).toBe(255);
  expect(image.face[0] - image.face[1]).toBeGreaterThan(25);
});

test('the portrait starts as monochrome dots and scattering reveals then covers the photo', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await loadPortrait(page);
  await expect(page.locator('#playground-stage')).toHaveAttribute('data-portrait-state', 'dots');
  expect(
    Number(await page.locator('#playground-stage').getAttribute('data-point-count')),
  ).toBeGreaterThan(4000);
  expect(await portraitColorRatio(page)).toBeLessThan(0.001);
  await page.getByRole('button', { name: 'Scatter the dots' }).click();
  await expect(page.getByRole('button', { name: 'Bring back the dots' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(() => portraitColorRatio(page)).toBeGreaterThan(0.08);
  await page.getByRole('button', { name: 'Bring back the dots' }).click();
  await expect.poll(() => portraitColorRatio(page)).toBeLessThan(0.001);
  await expect(page.locator('#playground-stage')).toHaveAttribute('data-portrait-state', 'dots');
  expect(errors).toEqual([]);
});

test('brushing or touching colors individual dots without opening a circular photo window', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    window.portfolioPortraitDraws = { triangles: 0, points: 0 };
    const originalArrays = WebGL2RenderingContext.prototype.drawArrays;
    const originalElements = WebGL2RenderingContext.prototype.drawElements;
    Object.defineProperty(WebGL2RenderingContext.prototype, 'drawArrays', {
      value: function (this: WebGL2RenderingContext, mode: number, first: number, count: number) {
        if (this.canvas instanceof HTMLCanvasElement && this.canvas.id === 'playground-canvas') {
          if (mode === this.POINTS) window.portfolioPortraitDraws.points = count;
          if (mode === this.TRIANGLES) window.portfolioPortraitDraws.triangles++;
        }
        return originalArrays.call(this, mode, first, count);
      },
    });
    Object.defineProperty(WebGL2RenderingContext.prototype, 'drawElements', {
      value: function (
        this: WebGL2RenderingContext,
        mode: number,
        count: number,
        type: number,
        offset: number,
      ) {
        if (this.canvas instanceof HTMLCanvasElement && this.canvas.id === 'playground-canvas') {
          if (mode === this.POINTS) window.portfolioPortraitDraws.points = count;
          if (mode === this.TRIANGLES) window.portfolioPortraitDraws.triangles++;
        }
        return originalElements.call(this, mode, count, type, offset);
      },
    });
  });
  await loadPortrait(page);
  const portraitPose = () =>
    page.locator('#playground-canvas').evaluate((element) => {
      if (!(element instanceof HTMLCanvasElement)) throw new Error('Missing portrait canvas.');
      const context = element.getContext('webgl2');
      if (!context) throw new Error('The portrait has no graphics context.');
      const program = context.getParameter(context.CURRENT_PROGRAM);
      if (!(program instanceof WebGLProgram)) throw new Error('The portrait has no active shader.');
      const location = context.getUniformLocation(program, 'modelViewMatrix');
      if (!location) throw new Error('The portrait transform is unavailable.');
      const matrix = context.getUniform(program, location);
      if (!(matrix instanceof Float32Array)) throw new Error('The portrait transform is invalid.');
      return Array.from(matrix);
    });
  const initialPose = await portraitPose();
  const restingPointCount = await page.evaluate(() => window.portfolioPortraitDraws.points);
  const availablePoints = Number(
    await page.locator('#playground-stage').getAttribute('data-point-count'),
  );
  expect(restingPointCount).toBeGreaterThan(4000);
  expect(restingPointCount).toBeLessThan(availablePoints / 8);
  expect(await portraitColorRatio(page)).toBeLessThan(0.001);
  const stage = await page.locator('#playground-stage').boundingBox();
  if (!stage) throw new Error('The portrait is not visible.');
  const point = {
    x: stage.x + stage.width * (testInfo.project.name === 'mobile' ? 0.53 : 0.64),
    y: stage.y + stage.height * 0.38,
  };
  if (testInfo.project.name === 'mobile') await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.move(point.x, point.y);
  await sweepPortrait(page, point, testInfo.project.name === 'mobile');
  await expect
    .poll(
      () =>
        portraitColorRatio(page, `artifacts\\${testInfo.project.name}-portrait-colored-dots.png`),
      { intervals: [30, 60, 100] },
    )
    .toBeGreaterThan(0.06);
  const draws = await page.evaluate(() => window.portfolioPortraitDraws);
  expect(availablePoints).toBeGreaterThan(40_000);
  expect(draws.points).toBeGreaterThan(restingPointCount * 2);
  expect(draws.points).toBeLessThan(availablePoints);
  expect(draws.triangles).toBe(0);
  expect(await portraitPose()).toEqual(initialPose);
  await expect(page.locator('.portrait-signature')).toHaveCSS('transform', 'none');
  await expect(page.locator('#portrait-scatter')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => portraitColorRatio(page)).toBeLessThan(0.001);
  await expect
    .poll(() => page.evaluate(() => window.portfolioPortraitDraws.points))
    .toBe(restingPointCount);
  await page.getByRole('button', { name: 'Scatter the dots' }).click();
  await expect
    .poll(() => page.evaluate(() => window.portfolioPortraitDraws.triangles))
    .toBeGreaterThan(0);
});

test('individual dots leave a soft trail, respond to speed, and expire under a stationary cursor', async ({
  page,
}, testInfo) => {
  await loadPortrait(page);
  const transition = await page.evaluate(async (mobile) => {
    const stage = document.getElementById('playground-stage');
    const canvas = document.getElementById('playground-canvas');
    if (!stage || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error('The portrait is unavailable for the transition measurement.');
    }
    const context = canvas.getContext('webgl2');
    if (!context) throw new Error('The portrait has no graphics context.');
    const program = context.getParameter(context.CURRENT_PROGRAM);
    if (!(program instanceof WebGLProgram)) throw new Error('The portrait has no active shader.');
    const strengthLocation = context.getUniformLocation(program, 'uDisturbance');
    const pointerLocation = context.getUniformLocation(program, 'uPointer');
    const radiusLocation = context.getUniformLocation(program, 'uBrushRadius');
    if (!strengthLocation || !pointerLocation || !radiusLocation) {
      throw new Error('The portrait brush uniforms are unavailable.');
    }
    const revealLocation = context.getAttribLocation(program, 'aReveal');
    if (revealLocation < 0) throw new Error('The per-dot reveal state is unavailable.');
    const revealBuffer = context.getVertexAttrib(
      revealLocation,
      context.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING,
    );
    if (!(revealBuffer instanceof WebGLBuffer))
      throw new Error('The per-dot reveal buffer is unavailable.');
    const readReveals = (target: Float32Array, index = 0) => {
      const previousBuffer = context.getParameter(context.ARRAY_BUFFER_BINDING);
      if (previousBuffer !== null && !(previousBuffer instanceof WebGLBuffer)) {
        throw new Error('The portrait attribute binding is invalid.');
      }
      context.bindBuffer(context.ARRAY_BUFFER, revealBuffer);
      try {
        context.getBufferSubData(
          context.ARRAY_BUFFER,
          index * Float32Array.BYTES_PER_ELEMENT,
          target,
        );
      } finally {
        context.bindBuffer(context.ARRAY_BUFFER, previousBuffer);
      }
    };
    let trackedIndex = 0;
    const trackedReveal = new Float32Array(1);
    const read = () => {
      const strength = context.getUniform(program, strengthLocation);
      const pointer = context.getUniform(program, pointerLocation);
      const radius = context.getUniform(program, radiusLocation);
      if (
        typeof strength !== 'number' ||
        typeof radius !== 'number' ||
        !(pointer instanceof Float32Array)
      ) {
        throw new Error('The portrait brush state is invalid.');
      }
      readReveals(trackedReveal, trackedIndex);
      return { strength, radius, x: pointer[0], y: pointer[1], reveal: trackedReveal[0] };
    };
    const sampleFrames = async (duration: number, stationaryX?: number) => {
      const samples: (ReturnType<typeof read> & { elapsed: number })[] = [];
      const start = performance.now();
      while (performance.now() - start < duration) {
        if (stationaryX !== undefined) move(stationaryX);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        samples.push({ ...read(), elapsed: performance.now() - start });
      }
      return samples;
    };
    const bounds = stage.getBoundingClientRect();
    const point = {
      x: bounds.x + bounds.width * (mobile ? 0.53 : 0.64),
      y: bounds.y + bounds.height * 0.38,
    };
    const move = (x: number) =>
      stage.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerType: mobile ? 'touch' : 'mouse',
          clientX: x,
          clientY: point.y,
        }),
      );
    const initial = read();
    move(point.x);
    const rise = await sampleFrames(350);
    const field = new Float32Array(Number(stage.dataset.pointCount));
    readReveals(field);
    for (let index = 0; index < field.length; index++) {
      if (field[index] > field[trackedIndex]) trackedIndex = index;
    }
    const distribution = {
      active: field.filter((value) => value > 0.02).length,
      levels: new Set(field.map((value) => Math.round(value * 20))).size,
    };
    const beforeMove = read();
    const destination = point.x + bounds.width * 0.3;
    move(destination);
    const travel = await sampleFrames(900, destination);
    readReveals(field);
    const expiredMaximum = field.reduce((maximum, value) => Math.max(maximum, value), 0);
    return { initial, rise, beforeMove, travel, distribution, expiredMaximum };
  }, testInfo.project.name === 'mobile');
  expect(transition.initial.strength).toBe(0);
  const firstActive = transition.rise.find((sample) => sample.strength > 0);
  expect(firstActive).toBeDefined();
  expect(firstActive?.strength).toBeLessThan(0.6);
  expect(Math.max(...transition.rise.map((sample) => sample.strength))).toBeGreaterThan(0.7);
  expect(transition.beforeMove.radius).toBeCloseTo(0.2, 3);
  expect(transition.beforeMove.reveal).toBeGreaterThan(0.8);
  expect(transition.distribution.active).toBeGreaterThan(20);
  expect(transition.distribution.levels).toBeGreaterThan(8);
  expect(Math.max(...transition.travel.map((sample) => sample.radius))).toBeGreaterThan(
    transition.beforeMove.radius * 2,
  );
  const distance = transition.travel.at(-1)!.x - transition.beforeMove.x;
  expect(distance).toBeGreaterThan(0.1);
  let previousX = transition.beforeMove.x;
  for (const sample of transition.travel) {
    expect(sample.x - previousX).toBeGreaterThanOrEqual(-0.00001);
    expect((sample.x - previousX) / distance).toBeLessThan(0.75);
    previousX = sample.x;
  }
  expect(
    transition.travel.some(
      (sample) =>
        sample.reveal > 0.3 &&
        Math.hypot(sample.x - transition.beforeMove.x, sample.y - transition.beforeMove.y) >
          sample.radius + 0.05,
    ),
    'Previously brushed dots should linger after the pointer has moved beyond their reach',
  ).toBe(true);
  const held = transition.travel.filter((sample) => sample.elapsed >= 200 && sample.elapsed <= 450);
  expect(held.length).toBeGreaterThan(0);
  expect(held.every((sample) => sample.strength > 0.9)).toBe(true);
  expect(
    transition.travel.some(
      (sample) =>
        sample.elapsed > 520 &&
        sample.elapsed < 670 &&
        sample.strength > 0 &&
        sample.strength < 0.95,
    ),
  ).toBe(true);
  const expired = transition.travel.filter((sample) => sample.elapsed >= 730);
  expect(expired.length).toBeGreaterThan(0);
  expect(expired.every((sample) => sample.strength === 0 && sample.reveal === 0)).toBe(true);
  expect(transition.expiredMaximum).toBe(0);
  await testInfo.attach('particle-brush-motion', {
    body: JSON.stringify(transition, null, 2),
    contentType: 'application/json',
  });
});

test('paused portraits stay still and keyboard reveal controls remain usable', async ({ page }) => {
  await loadPortrait(page);
  await page.getByRole('button', { name: 'Pause animations' }).click();
  const canvas = page.locator('#playground-canvas');
  const paused = await canvas.screenshot();
  await page.waitForTimeout(250);
  expect(Buffer.compare(await canvas.screenshot(), paused)).toBe(0);
  const button = page.getByRole('button', { name: 'Scatter the dots' });
  await expect(button).toBeEnabled();
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Bring back the dots' })).toBeFocused();
  expect(await portraitColorRatio(page)).toBeGreaterThan(0.08);
  const revealed = await canvas.screenshot();
  await page.waitForTimeout(250);
  expect(Buffer.compare(await canvas.screenshot(), revealed)).toBe(0);
  await page.keyboard.press('Enter');
  expect(await portraitColorRatio(page)).toBeLessThan(0.001);
});

test('portrait loading failures leave only the monochrome fallback', async ({ page }) => {
  await page.route('**/eesha-portrait.webp', (route) => route.abort());
  await loadPortfolio(page);
  await page.locator('#playground-stage').scrollIntoViewIfNeeded();
  await expect(page.locator('#playground-status')).toContainText('could not start');
  await expect(page.locator('.portrait-fallback')).toBeVisible();
  await expect(page.locator('.portrait-fallback')).toHaveAttribute(
    'src',
    './images/eesha-dots.webp',
  );
  await expect(page.locator('#portrait-scatter')).toBeDisabled();
  expect(await portraitColorRatio(page)).toBeLessThan(0.001);
});

test('contact actions and the preserved resume work', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await loadPortfolio(page);
  await page.getByRole('button', { name: 'Copy email address' }).click();
  await expect(page.locator('#copy-status')).toContainText('COPIED.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('eesha.kavuri@gmail.com');
  await expect(page.locator('.email-link')).toHaveAttribute(
    'href',
    'mailto:eesha.kavuri@gmail.com',
  );
  await expect(page.locator('.social-links').getByRole('link', { name: /GitHub/ })).toHaveAttribute(
    'href',
    'https://github.com/EeshaKavuri',
  );
  await expect(
    page.locator('.social-links').getByRole('link', { name: /LinkedIn/ }),
  ).toHaveAttribute('href', 'https://www.linkedin.com/in/eesha-kavuri-902b52203/');
  const response = await page.request.get('/Eesha_Resume_2026.pdf');
  expect(response.ok()).toBe(true);
  expect((await response.body()).subarray(0, 4).toString()).toBe('%PDF');
  const downloadPromise = page.waitForEvent('download');
  await page
    .locator('.social-links')
    .getByRole('link', { name: /Resume/ })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Eesha_Resume_2026.pdf');
});

test('clipboard denial reports the problem instead of false success', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new DOMException('Permission denied', 'NotAllowedError');
        },
      },
    });
  });
  await loadPortfolio(page);
  await page.getByRole('button', { name: 'Copy email address' }).click();
  await expect(page.locator('#copy-status')).toContainText('COPY UNAVAILABLE.');
  await expect(page.locator('#copy-status')).not.toContainText('COPIED.');
});

test('a browser without WebGL retains artwork and project navigation', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type.includes('webgl')) return null;
        return Reflect.apply(original, this, [type, ...args]);
      },
    });
  });
  await loadPortfolio(page);
  await expect(page.locator('.machine-fallback')).toBeVisible();
  await expect(page.locator('#art-status')).toContainText('3D IS UNAVAILABLE');
  await expect(page.locator('#perspective-button')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next featured project' }).click();
  await page.getByRole('button', { name: 'Explore featured project: SketchbookLM' }).click();
  await expect(page.locator('#dialog-title')).toHaveText('SketchbookLM');
  await page.keyboard.press('Escape');
  await expect(page.locator('#terminal-artwork')).toBeVisible();
  await expect(page.locator('#terminal-artwork')).toHaveAttribute('src', './images/sketchbook.svg');
  await page.locator('#playground-stage').scrollIntoViewIfNeeded();
  await expect(page.locator('#playground-status')).toContainText('could not start');
  await expect(page.locator('.portrait-fallback')).toBeVisible();
  expect(await portraitColorRatio(page)).toBeLessThan(0.001);
});

test('has no horizontal overflow across small and large viewports', async ({ page }) => {
  await loadPortfolio(page);
  await page.getByRole('button', { name: 'Pause animations' }).click();
  await page.locator('#playground-stage').scrollIntoViewIfNeeded();
  await expect(page.locator('#playground-stage')).toHaveClass(/has-canvas/);
  await page.locator('#home').scrollIntoViewIfNeeded();
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(1);
  }
});

test('meets automated accessibility checks on the page and project dialog', async ({ page }) => {
  await loadPortfolio(page);
  await page.getByRole('button', { name: 'Pause animations' }).click();
  await page.locator('#playground-stage').scrollIntoViewIfNeeded();
  await expect(page.locator('#playground-stage')).toHaveClass(/has-canvas/);
  await page.locator('#home').scrollIntoViewIfNeeded();
  const pageResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(pageResults.violations).toEqual([]);
  await page.getByRole('button', { name: 'Explore EngHub Get Right', exact: true }).click();
  const dialogResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(dialogResults.violations).toEqual([]);
});

test('captures the finished experience', async ({ page }, testInfo) => {
  await loadPortfolio(page);
  await expect(page.locator('#hero-art')).toHaveClass(/has-webgl/);
  await expect(page.locator('#art-status')).toBeEmpty();
  await mkdir('artifacts', { recursive: true });
  await expect(page.locator('#machine-canvas')).toHaveAttribute('data-displayed-project', 'enghub');
  const name = testInfo.project.name;
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images, (image) => {
        image.loading = 'eager';
        return image.decode();
      }),
    );
  });
  await page.screenshot({ path: `artifacts\\${name}-hero.png` });
  await page.getByRole('button', { name: 'Pause animations' }).click();
  await page.screenshot({ path: `artifacts\\${name}-full.png`, fullPage: true });
  await page.locator('#work').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts\\${name}-work.png` });
  await page.locator('#journey').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts\\${name}-career.png` });
  await page.locator('.education-row').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts\\${name}-education.png` });
  await page.locator('#playground-stage').scrollIntoViewIfNeeded();
  await expect(page.locator('#playground-stage')).toHaveClass(/has-canvas/);
  await page.screenshot({ path: `artifacts\\${name}-portrait-dots.png` });
  await page.getByRole('button', { name: 'Scatter the dots' }).click();
  await page.screenshot({ path: `artifacts\\${name}-portrait-photo.png` });
  await page.getByRole('button', { name: 'Explore SketchbookLM', exact: true }).click();
  await page.screenshot({ path: `artifacts\\${name}-project.png` });
});
