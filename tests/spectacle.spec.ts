import { expect } from '@playwright/test';
import { openBook, sceneAt, test } from './reader-harness';
import { stagePose } from './playback-harness';
import { changedPixels } from './visible-pixels';

const passages = [
  { id: 5, pose: .30, selector: '[data-sky-passage="cherry-wind"]' },
  { id: 11, pose: .58, selector: '.ascent-clouds, .ascent-currents, .ascent-star, .ascent-lightshaft' },
  { id: 14, pose: .68, selector: '.winter-light' },
];

test('new scenic effects reach the visible painting while the reader rests', async ({ page }) => {
  // Freeze before loading so screenshots sample one pose even on a slow runner.
  await page.clock.install({ time: new Date('2025-02-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2025-02-01T00:10:00Z'));
  await openBook(page);
  for (const { id, pose, selector } of passages) {
    await test.step('Scene ' + id, async () => {
      const stage = sceneAt(page, id).locator('.portrait-stage');
      await stage.evaluate(art => art.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await expect.poll(async () => {
        await page.clock.runFor(16);
        return stage.getAttribute('data-playback');
      }).toBe('playing');
      await stage.evaluate(async art => {
        await Promise.all(Array.from(art.querySelectorAll('img[src]'), img => (img as HTMLImageElement).decode()));
      });
      const startY = await page.evaluate(() => scrollY);
      for (let i = 0; i < 160 && (await stagePose(stage)) < pose; i++) await page.clock.runFor(32);
      expect(await stagePose(stage)).toBeCloseTo(pose, 1);
      const art = await stage.boundingBox();
      const viewport = page.viewportSize()!;
      if (!art) throw Error('The painting must have a visible area');
      const x = Math.max(0, Math.ceil(art.x)), y = Math.max(0, Math.ceil(art.y));
      const width = Math.min(viewport.width, Math.floor(art.x + art.width)) - x;
      const height = Math.min(viewport.height, Math.floor(art.y + art.height)) - y;
      const clip = { x, y, width, height };
      // Compare exactly the same frame with and without the feature. A change
      // to an occluded or transparent layer cannot produce a passing count.
      const lit = await page.screenshot({ clip, scale: 'css' });
      const mask = await page.addStyleTag({ content: selector + '{display:none!important}' });
      let unlit: Buffer;
      try { unlit = await page.screenshot({ clip, scale: 'css' }); }
      finally { await mask.evaluate(node => node.parentNode?.removeChild(node)); }
      const changed = await changedPixels(page, lit, unlit, 14);
      expect(changed / (width * height), 'The optical effect visibly contributes to the portrait').toBeGreaterThan(.003);
      expect(await page.evaluate(() => scrollY)).toBe(startY);
    });
  }
});
