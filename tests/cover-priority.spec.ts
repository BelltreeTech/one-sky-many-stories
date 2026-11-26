import { expect } from '@playwright/test';
import { test } from './reader-harness';

test('nearby artwork waits for the cover or the reader’s first scroll', async ({ page, context }, info) => {
  const folder = info.project.name === 'desktop-chromium' ? 'art' : 'portrait';
  const cover = new RegExp('/' + folder + '/01\\.webp$');
  let allowCover!: () => void;
  const hold = new Promise<void>(resolve => { allowCover = resolve; });
  await page.route(cover, async route => {
    await hold;
    await route.continue();
  });
  try {
    await page.goto('./', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.opening .passage')).toContainText('Luna climbed a little hill');
    await expect(page.locator('.opening img.scene-image')).toHaveAttribute('src',cover);
    expect(await page.locator('[data-scene="2"] .scene-image').getAttribute('src')).toBeNull();
    await page.evaluate(() => scrollBy({top:90,behavior:'instant'}));
    await expect(page.locator('[data-scene="2"] .scene-image')).toHaveAttribute('src', new RegExp('/' + folder + '/02\\.webp$'));
  } finally {
    allowCover();
  }
  await page.locator('.opening img.scene-image').evaluate(img => (img as HTMLImageElement).decode());
  const fresh = await context.newPage();
  try {
    await fresh.goto(page.url());
    await fresh.locator('.opening .scene-image[src]').evaluate(img => (img as HTMLImageElement).decode());
    await expect(fresh.locator('[data-scene="2"] .scene-image')).toHaveAttribute('src', new RegExp('/' + folder + '/02\\.webp$'));
    expect(await fresh.evaluate(() => scrollY)).toBe(0);
  } finally {
    await fresh.close();
  }
});
