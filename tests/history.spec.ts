import { expect } from '@playwright/test';
import { oracle, test } from './reader-harness';

test('Safari history preserves a reading pause, and a fresh link opens at the cover', async ({ page, context }) => {
  await page.goto('./');
  const scene = page.locator('[data-scene="11"]');
  const text = scene.locator('.beat-text').last();
  await text.waitFor();
  await page.evaluate(() => document.fonts.ready);
  await text.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(page.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', '11');
  const position = () => text.evaluate(node => node.getBoundingClientRect().top);
  const startingTop = await position();
  const words = await text.textContent();
  const address = page.url();
  await page.goto(new URL('star.svg', address).href);
  await page.goBack();
  await text.waitFor();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => Math.abs((await position()) - startingTop)).toBeLessThan(3);
  await expect(text).toHaveText(words!.trim());
  const returnTop = await position();
  await page.reload();
  await text.waitFor();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => Math.abs((await position()) - returnTop)).toBeLessThan(3);
  await expect(page.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', '11');
  const fresh = await context.newPage();
  try {
    await fresh.goto(address);
    await expect(fresh.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', '1');
    expect(await fresh.evaluate(() => scrollY)).toBe(0);
  } finally {
    await fresh.close();
  }
  const linked = await context.newPage();
  try {
    await linked.goto(new URL('#scene-05', address).href);
    const fifth = linked.locator('[data-scene="5"]');
    await expect(linked.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', '5');
    const image = fifth.locator('.scene-image');
    await expect(image).toHaveAttribute('src', /\/portrait\/05\.webp$/);
    const inView = await image.evaluate(async (img: HTMLImageElement) => {
      await img.decode();
      const bounds = img.getBoundingClientRect();
      return img.naturalHeight > img.naturalWidth && bounds.height > bounds.width && bounds.bottom > 0 && bounds.top < innerHeight;
    });
    expect(inView).toBe(true);
    expect(await fifth.locator('.passage').textContent()).toBe(oracle.scenes[4].text);
    await linked.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(linked.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', '1');
    await linked.reload();
    await expect(linked.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', '1');
    await expect.poll(() => linked.evaluate(() => scrollY)).toBe(0);
  } finally {
    await linked.close();
  }
});
