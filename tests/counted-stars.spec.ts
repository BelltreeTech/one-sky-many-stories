import { expect, type Locator, type Page } from '@playwright/test';
import { openBook, sceneAt, test } from './reader-harness';
import { stagePose } from './playback-harness';

// Capture what reaches the reader. An opaque camera insert can completely
// hide a pulse whose underlying DOM geometry and opacity are both correct.
async function visiblePulsePixels(page: Page, star: Locator) {
  const crop = star.locator('..');
  const clip = await crop.boundingBox();
  if (!clip) throw Error('The painted star must be visible');
  const lit = await page.screenshot({ scale: 'css', clip });
  await star.evaluate(node => { node.style.visibility = 'hidden'; });
  let unlit: Buffer;
  try {
    unlit = await page.screenshot({ scale: 'css', clip });
  } finally {
    await star.evaluate(node => node.style.removeProperty('visibility'));
  }
  return page.evaluate(async images => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    for (const [index, png] of images.entries()) {
      const image = new Image();
      image.src = 'data:image/png;base64,' + png;
      await image.decode();
      if (index === 0) { canvas.width = image.width; canvas.height = image.height; }
      else ctx.globalCompositeOperation = 'difference';
      ctx.drawImage(image, 0, 0);
    }
    const differences = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let visible = 0;
    for (let i = 0; i < differences.length; i += 4) {
      if (Math.max(differences[i], differences[i + 1], differences[i + 2]) > 8) visible++;
    }
    return visible;
  }, [lit.toString('base64'), unlit.toString('base64')]);
}

for (const viewport of [{ width: 393, height: 852 }, { width: 1280, height: 320 }]) {
  test(`all six stars reach peak brightness in view and in order at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    // Freeze before loading the reader. The time between two browser protocol
    // calls on a busy runner must not consume part of the first star's pulse.
    await page.clock.install({ time: new Date('2025-02-01T00:00:00Z') });
    await page.clock.pauseAt(new Date('2025-02-01T00:10:00Z'));
    await openBook(page);
    const stage = sceneAt(page, 7).locator('.portrait-stage');
    await stage.evaluate(art => {
      const box = art.getBoundingClientRect();
      scrollBy({ top: box.top + .18 * box.height - innerHeight / 2, behavior: 'instant' });
    });
    await expect.poll(async () => {
      await page.clock.runFor(16);
      return stage.getAttribute('data-playback');
    }).toBe('playing');
    const lights = stage.locator('[data-painted-detail^="counted-star-"] > i');
    await expect(lights).toHaveCount(6);
    const firstY = await page.evaluate(() => scrollY);
    const peaks = Array.from({ length: 6 }, () => ({ opacity: -1, progress: 0 }));
    const pixels = new Map<number, number>();
    for (let frame = 0; frame < 135; frame++) {
      const progress = await stagePose(stage);
      const samples = await lights.evaluateAll(nodes => nodes.map(node => {
        const { top, bottom } = node.getBoundingClientRect();
        return { opacity: Number(getComputedStyle(node).opacity), top, bottom };
      }));
      for (const [index, sample] of samples.entries()) {
        if (sample.opacity > peaks[index].opacity) peaks[index] = { opacity: sample.opacity, progress };
        if (sample.opacity > .60 && !pixels.has(index)) {
          expect(sample.top).toBeGreaterThanOrEqual(0);
          expect(sample.bottom).toBeLessThanOrEqual(viewport.height);
          pixels.set(index, await visiblePulsePixels(page, lights.nth(index)));
        }
      }
      if (progress >= 1) break;
      await page.clock.runFor(40);
    }
    await expect(stage).toHaveAttribute('data-playback', 'complete');
    expect(await page.evaluate(() => scrollY)).toBe(firstY);
    for (const [index, peak] of peaks.entries()) {
      const label = 'star ' + (index + 1);
      expect(peak.opacity, label + ' should light up').toBeGreaterThan(.60);
      if (index) expect(peak.progress).toBeGreaterThan(peaks[index - 1].progress);
      expect(pixels.get(index), label + ' should brighten the actual painting').toBeGreaterThan(8);
    }
  });
}
