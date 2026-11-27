import { expect } from '@playwright/test';
import { expectImageFailures, openBook, test } from './reader-harness';

test('a decoded telescope stays at the current aperture while the hillside arrives', async ({ page }, info) => {
  let allowHillside = () => {};
  const hold = new Promise<void>(resolve => { allowHillside = resolve; });
  await page.route(/\/portrait\/08\.webp(?:\?|$)/, async route => {
    await hold;
    await route.continue();
  });
  try {
    await openBook(page);
    const scene = page.locator('#scene-08');
    const main = scene.locator('.scene-image');
    const lens = scene.locator('.lens-field');
    const image = lens.locator('.telescope-view');
    await lens.evaluate(el => scrollBy({ top: el.getBoundingClientRect().top - innerHeight * .80, behavior: 'instant' }));
    await expect(image).toHaveAttribute('data-ready', 'true');
    await expect(scene.locator('[data-illustration-motion]')).toHaveCount(0);
    expect(await main.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBe(0);

    const read = () => lens.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return {
        y: scrollY, aperture: getComputedStyle(el).getPropertyValue('--aperture').trim(),
        mask: getComputedStyle(el.querySelector('.telescope-view')!).maskImage,
        clip: { x: Math.ceil(rect.left), y: Math.ceil(rect.top), width: Math.floor(rect.width - 1),
          height: Math.floor(Math.min(rect.bottom, innerHeight) - Math.ceil(rect.top)) },
      };
    });
    const waiting = await read();
    const before = await page.screenshot({ clip: waiting.clip });
    await info.attach('telescope-awaiting-hillside', { body: before, contentType: 'image/png' });
    allowHillside();
    await expect(scene.locator('[data-illustration-motion]')).toHaveCount(1);
    await expect.poll(() => main.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const loaded = await read();
    const after = await page.screenshot({ clip: waiting.clip });
    await info.attach('telescope-after-hillside', { body: after, contentType: 'image/png' });
    expect(loaded.y).toBe(waiting.y);
    expect(Number(loaded.aperture)).toBeGreaterThan(.05);
    expect(Number(loaded.aperture)).toBeLessThan(.8);
    expect(loaded.mask, 'a stationary lens keeps the same painted mask').toBe(waiting.mask);
    expect(after.equals(before), 'the visible part of the lens does not flash').toBe(true);
  } finally {
    allowHillside();
  }
});

test('the telescope holds its view through a hillside preview and pending full retry', async ({ page, baseURL }) => {
  expectImageFailures(page, [new URL('portrait/08.webp', baseURL).href]);
  let fail = () => {}, recover = () => {};
  const first = new Promise<void>(r => { fail = r; });
  const retry = new Promise<void>(r => { recover = r; });
  await page.route(/\/portrait\/08\.webp(?:\?|$)/, async route => {
    if (route.request().url().includes('retry=')) { await retry; return route.continue(); }
    await first;
    await route.fulfill({ status: 503, body: 'temporary' });
  });
  try {
    await openBook(page);
    const scene = page.locator('#scene-08'), lens = scene.locator('.lens-field');
    const art = scene.locator('.scene-image'), camera = scene.locator('.camera');
    await lens.evaluate(el => scrollBy({ top: el.getBoundingClientRect().top - innerHeight * .80, behavior: 'instant' }));
    await expect(lens.locator('img')).toHaveAttribute('data-ready', 'true');
    const aperture = () => lens.evaluate(el => Number(el.style.getPropertyValue('--aperture') || '1'));
    const held = await aperture();
    expect(held).toBeGreaterThan(.05);
    expect(held).toBeLessThan(.8);
    const clip = await lens.evaluate(el => {
      const r = el.getBoundingClientRect(), y = Math.ceil(r.top);
      return { x: Math.ceil(r.left), y, width: Math.floor(r.width - 1), height: Math.floor(Math.min(innerHeight, r.bottom) - y) };
    });
    const original = await page.screenshot({ clip });
    const unchanged = async () => {
      expect(await aperture()).toBe(held);
      expect((await page.screenshot({ clip })).equals(original)).toBe(true);
    };
    fail();
    await expect(art).toHaveAttribute('data-fallback', 'true');
    await art.evaluate(el => (el as HTMLImageElement).decode());
    await expect(camera).toHaveCSS('transform', 'none');
    await unchanged();
    await page.evaluate(() => dispatchEvent(new Event('online')));
    await expect(art).toHaveAttribute('src', /08\.webp\?retry=/);
    await expect(camera).toHaveCSS('transform', 'none');
    await unchanged();
    recover();
    await expect(scene.locator('[data-illustration-motion]')).toHaveCount(1);
    await expect(camera).not.toHaveCSS('transform', 'none');
    await unchanged();
  } finally { fail(); recover(); }
});
