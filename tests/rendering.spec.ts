import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

declare global {
  interface Window {
    portfolioTestDraws: Record<string, number>;
    portfolioTestRestore: () => void;
  }
}

async function load(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#machine-canvas')).toHaveAttribute('data-displayed-project', 'enghub');
}

test('the terminal renders on demand and the portrait stops when paused or offscreen', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.portfolioTestDraws = {};
    for (const method of [
      'drawArrays',
      'drawElements',
      'drawArraysInstanced',
      'drawElementsInstanced',
    ] as const) {
      const original = WebGL2RenderingContext.prototype[method];
      Object.defineProperty(WebGL2RenderingContext.prototype, method, {
        value: function (this: WebGL2RenderingContext, ...args: unknown[]) {
          if (this.canvas instanceof HTMLCanvasElement) {
            const id = this.canvas.id || this.canvas.parentElement?.id || 'unattached';
            window.portfolioTestDraws[id] = (window.portfolioTestDraws[id] ?? 0) + 1;
          }
          return Reflect.apply(original, this, args);
        },
      });
    }
  });
  await load(page);
  await page.waitForTimeout(200);
  const idleTerminal = await page.evaluate(() => window.portfolioTestDraws['machine-canvas']);
  expect(idleTerminal).toBeGreaterThan(0);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.portfolioTestDraws['machine-canvas'])).toBe(idleTerminal);
  await page.getByRole('button', { name: 'Next featured project' }).click();
  await expect
    .poll(() => page.evaluate(() => window.portfolioTestDraws['machine-canvas']))
    .toBeGreaterThan(idleTerminal);

  await page.locator('#playground-stage').scrollIntoViewIfNeeded();
  await expect(page.locator('#playground-stage')).toHaveClass(/has-canvas/);
  const initial = await page.evaluate(() => window.portfolioTestDraws['playground-canvas']);
  await expect
    .poll(() => page.evaluate(() => window.portfolioTestDraws['playground-canvas']))
    .toBeGreaterThan(initial + 2);
  await page.getByRole('button', { name: 'Pause animations' }).click();
  const paused = await page.evaluate(() => window.portfolioTestDraws['playground-canvas']);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.portfolioTestDraws['playground-canvas'])).toBe(paused);
  await page.getByRole('button', { name: 'Resume animations' }).click();
  await expect
    .poll(() => page.evaluate(() => window.portfolioTestDraws['playground-canvas']))
    .toBeGreaterThan(paused + 2);
  await page.locator('#home').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const offscreen = await page.evaluate(() => window.portfolioTestDraws['playground-canvas']);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.portfolioTestDraws['playground-canvas'])).toBe(offscreen);
});

test('graphics interruptions preserve controls, use dotted fallback, and recover', async ({
  page,
}, testInfo) => {
  await load(page);
  await expect(page.locator('.machine-fallback')).toHaveCSS('opacity', '0');
  const terminal = page.locator('#machine-canvas canvas');
  const screenshotOptions = {
    animations: 'disabled',
    style:
      '.hero-stamp, .terminal-controls, .terminal-open, .terminal-hint { visibility: hidden !important; }',
  } as const;
  const originalTerminal = await terminal.screenshot(screenshotOptions);
  const loseContext = async (selector: string): Promise<void> => {
    await page.locator(selector).evaluate((element) => {
      if (!(element instanceof HTMLCanvasElement)) throw new Error('Missing graphics canvas.');
      const extension = element.getContext('webgl2')?.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('The test browser cannot simulate graphics interruptions.');
      window.portfolioTestRestore = () => extension.restoreContext();
      extension.loseContext();
    });
  };
  await loseContext('#machine-canvas canvas');
  await expect(page.locator('#hero-art')).not.toHaveClass(/has-webgl/);
  await expect(page.locator('.machine-fallback')).toBeVisible();
  await expect(page.locator('#art-status')).toContainText('GRAPHICS WERE INTERRUPTED');
  await page.getByRole('button', { name: 'Next featured project' }).click();
  await page.getByRole('button', { name: 'Explore featured project: SketchbookLM' }).click();
  await expect(page.locator('#dialog-title')).toHaveText('SketchbookLM');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.portfolioTestRestore());
  await expect(page.locator('#hero-art')).toHaveClass(/has-webgl/);
  await expect(page.locator('#machine-canvas')).toHaveAttribute(
    'data-displayed-project',
    'sketchbook',
  );
  await expect(page.locator('#art-status')).toBeEmpty();
  await expect(page.locator('#machine-canvas')).toHaveAttribute('data-channel-state', 'ready');
  await page.screenshot({ path: `artifacts\\${testInfo.project.name}-terminal-restored.png` });
  await page.getByRole('button', { name: 'Previous featured project' }).click();
  await expect(page.locator('#machine-canvas')).toHaveAttribute('data-displayed-project', 'enghub');
  await expect(page.locator('#machine-canvas')).toHaveAttribute('data-channel-state', 'ready');
  await expect(page.locator('.machine-fallback')).toHaveCSS('opacity', '0');
  const restoredTerminal = await terminal.screenshot(screenshotOptions);
  await testInfo.attach('terminal-before', { body: originalTerminal, contentType: 'image/png' });
  await testInfo.attach('terminal-after', { body: restoredTerminal, contentType: 'image/png' });
  expect(Buffer.compare(restoredTerminal, originalTerminal)).toBe(0);

  await page.locator('#playground-stage').scrollIntoViewIfNeeded();
  await expect(page.locator('#playground-stage')).toHaveClass(/has-canvas/);
  await loseContext('#playground-canvas');
  await expect(page.locator('.portrait-fallback')).toBeVisible();
  await expect(page.locator('#playground-status')).toContainText('dots-only');
  await expect(page.locator('#portrait-scatter')).toBeDisabled();
  await page.evaluate(() => window.portfolioTestRestore());
  await expect(page.locator('#playground-stage')).toHaveClass(/has-canvas/);
  await expect(page.locator('#portrait-scatter')).toBeEnabled();
  await page.getByRole('button', { name: 'Scatter the dots' }).click();
  await expect(page.getByRole('button', { name: 'Bring back the dots' })).toBeVisible();
});

test('records comparable frame pacing and a continuous full-page scroll', async ({
  page,
}, testInfo) => {
  await load(page);
  const results: Record<
    string,
    { frames: number; medianMs: number; p95Ms: number; framesOver32Ms: number }
  > = {};
  const measure = (mode: 'still' | 'scroll' | 'brush' | 'brush-fast') =>
    page.evaluate(async (mode) => {
      return new Promise<{
        frames: number;
        medianMs: number;
        p95Ms: number;
        framesOver32Ms: number;
      }>((resolve) => {
        const durations: number[] = [];
        let start = 0;
        let previous = 0;
        const distance = document.documentElement.scrollHeight - window.innerHeight;
        const stage = document.getElementById('playground-stage');
        const portrait = stage?.getBoundingClientRect();
        const brushing = mode === 'brush' || mode === 'brush-fast';
        if (brushing && (!stage || !portrait)) {
          throw new Error('The portrait is unavailable for the moving-brush measurement.');
        }
        const tick = (time: number): void => {
          if (!start) start = time;
          if (previous) durations.push(time - previous);
          previous = time;
          const progress = Math.min(1, (time - start) / 1400);
          if (mode === 'scroll') window.scrollTo({ top: distance * progress, behavior: 'instant' });
          if (brushing && stage && portrait) {
            const fast = mode === 'brush-fast';
            const angle = progress * Math.PI * (fast ? 8 : 2);
            stage.dispatchEvent(
              new PointerEvent('pointermove', {
                pointerType: 'mouse',
                clientX:
                  portrait.x +
                  portrait.width *
                    ((window.innerWidth <= 760 ? 0.53 : 0.64) +
                      Math.cos(angle) * (fast ? 0.075 : 0.025)),
                clientY:
                  portrait.y + portrait.height * (0.38 + Math.sin(angle) * (fast ? 0.11 : 0.035)),
              }),
            );
          }
          if (progress < 1) requestAnimationFrame(tick);
          else {
            durations.sort((a, b) => a - b);
            resolve({
              frames: durations.length,
              medianMs: durations[Math.floor(durations.length / 2)],
              p95Ms: durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))],
              framesOver32Ms: durations.filter((duration) => duration > 32).length,
            });
          }
        };
        requestAnimationFrame(tick);
      });
    }, mode);
  for (const [name, selector] of [
    ['home', '#home'],
    ['about', '#about'],
    ['playground', '#playground-stage'],
  ]) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    if (name === 'playground') await expect(page.locator(selector)).toHaveClass(/has-canvas/);
    await page.waitForTimeout(250);
    results[name] = await measure('still');
    expect(results[name].medianMs, `${name} median frame time`).toBeLessThan(50);
  }
  const portrait = await page.locator('#playground-stage').boundingBox();
  if (!portrait) throw new Error('The portrait is unavailable for the dense-reveal measurement.');
  await page.mouse.move(
    portrait.x + portrait.width * (testInfo.project.name === 'mobile' ? 0.53 : 0.64),
    portrait.y + portrait.height * 0.38,
  );
  results.revealedPortrait = await measure('brush');
  expect(results.revealedPortrait.medianMs, 'Dense reveal median frame time').toBeLessThan(50);
  expect(results.playground.frames, 'Resting portrait frame budget').toBeGreaterThan(
    results.home.frames * 0.8,
  );
  expect(results.revealedPortrait.frames, 'Dense reveal frame budget').toBeGreaterThan(
    results.home.frames * 0.8,
  );
  results.aggressivePortrait = await measure('brush-fast');
  expect(results.aggressivePortrait.medianMs, 'Fast moving-dot frame time').toBeLessThan(50);
  expect(results.aggressivePortrait.frames, 'Fast moving-dot frame budget').toBeGreaterThan(
    results.home.frames * 0.8,
  );
  await page.mouse.move(0, 0);
  await page.locator('#home').scrollIntoViewIfNeeded();
  results.scroll = await measure('scroll');
  await expect
    .poll(() =>
      page
        .locator('.site-header')
        .evaluate((header) =>
          Number(getComputedStyle(header).getPropertyValue('--scroll-progress')),
        ),
    )
    .toBeGreaterThan(0.99);
  await writeFile(
    `artifacts\\performance-after-${testInfo.project.name}.json`,
    JSON.stringify(results, null, 2),
  );
});
