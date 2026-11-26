import { expect } from '@playwright/test';
import { expectImageFailures, openBook, oracle, sceneAt, test, visitScene } from './reader-harness';

const portrait = { width: 393, height: 852 };
const landscape = { width: 852, height: 393 };

test('rotating at the telescope keeps the same reading beat within the continuous strip', async ({ page }) => {
  await page.setViewportSize(landscape);
  await openBook(page);
  const scene = await visitScene(page, 8);
  const second = scene.locator('[data-beat="2"] .beat-text');
  const position = () => second.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return (rect.top + rect.height / 2) / innerHeight;
  });
  await second.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect.poll(position).toBeCloseTo(.5, 2);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  for (const viewport of [portrait, landscape, portrait]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', '8');
    await expect(second).toHaveCount(1);
    await expect.poll(async () => Math.abs(await position() - .5)).toBeLessThan(.035);
    await expect(scene.locator('.scene-image')).toHaveAttribute('src', /\/portrait\/08\.webp$/);
  }
});

test('a recovered portrait paints the sisters’ actual hair, sleeve and cloud edges', async ({ page, baseURL }) => {
  await page.setViewportSize(portrait);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expectImageFailures(page, [new URL('portrait/11.webp', baseURL).href]);
  let recovered = false;
  await page.route(/\/portrait\/11\.webp(?:\?.*)?$/, route => recovered ? route.continue() : route.fulfill({ status: 503, body: 'temporarily unavailable' }));
  await openBook(page);
  const scene = await visitScene(page, 11);
  const image = scene.locator('.scene-image');
  await expect(image).toHaveAttribute('data-fallback', 'true');
  await expect(image).toHaveAttribute('src', /\/portrait\/preview\/11\.webp$/);
  expect(await image.evaluate(async (el: HTMLImageElement) => { await el.decode(); return el.naturalWidth; })).toBe(360);
  recovered = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(image).toHaveAttribute('data-fallback', 'false');
  await image.evaluate((el: HTMLImageElement) => el.decode());
  await scene.locator('.portrait-stage').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const displacements = await scene.locator('.afterglow').evaluate(async el => {
    const edges = [...el.querySelectorAll('i')];
    const peak = edges.map(() => 0);
    for (let i = 0; i < 26; i++) {
      scrollBy({ top: 3, behavior: 'instant' });
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      edges.forEach((edge, index) => {
        const style = getComputedStyle(edge);
        if (style.backgroundImage === 'none' || !edge.getClientRects().length) return;
        const matrix = new DOMMatrixReadOnly(style.transform);
        peak[index] = Math.max(peak[index], Math.hypot(matrix.m41, matrix.m42));
      });
    }
    return peak;
  });
  await test.info().attach('recovered-edges.json', { body: JSON.stringify({ cloud: displacements[0], sleeve: displacements[1], hair: displacements[2] }), contentType: 'application/json' });
  expect(displacements).toHaveLength(3);
  expect(Math.min(...displacements), 'Every rendered edge moves after the original portrait returns').toBeGreaterThan(.02);
});

test('a transient 503 while online recovers in place and a persistent failure has a bounded retry', async ({ page, baseURL }) => {
  await page.setViewportSize(portrait);
  const failures = [12, 19].flatMap(id => ['portrait', 'portrait/preview'].map(folder => new URL(`${folder}/${id}.webp`, baseURL).href));
  expectImageFailures(page, failures);
  const attempts = new Map<string, Set<string>>();
  const requestCounts = new Map<string, number>();
  let recovered = false;
  await page.route(/\/portrait\/(?:preview\/)?(?:12|19)\.webp(?:\?.*)?$/, route => {
    const url = new URL(route.request().url());
    requestCounts.set(url.pathname, (requestCounts.get(url.pathname) ?? 0) + 1);
    const versions = attempts.get(url.pathname) ?? new Set<string>();
    versions.add(url.search); attempts.set(url.pathname, versions);
    if (url.pathname.endsWith('/12.webp') && recovered) return route.continue();
    return route.fulfill({ status: 503, body: 'temporarily unavailable' });
  });
  const versions = (file: string) => attempts.get(new URL(file, baseURL).pathname)?.size ?? 0;
  await openBook(page);
  const scene = await visitScene(page, 12);
  const picture = scene.locator('.scene-image');
  await expect.poll(() => versions('portrait/preview/12.webp')).toBe(1);
  const y = await page.evaluate(() => scrollY);
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  recovered = true;
  // An HTTP 503 does not change navigator.onLine or dispatch an online event.
  await expect.poll(() => picture.evaluate((el: HTMLImageElement) => el.naturalWidth > 0 && el.currentSrc.includes('/portrait/12.webp'))).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(y);
  expect(await scene.locator('.passage').textContent()).toBe(oracle.scenes[11].text);
  expect(versions('portrait/19.webp')).toBe(0);
  const end = await visitScene(page, 19);
  await expect.poll(() => versions('portrait/preview/19.webp')).toBe(2);
  await expect(end.locator('.scene-image')).not.toHaveAttribute('src');
  const requestsForScene = () => ['portrait/19.webp', 'portrait/preview/19.webp']
    .map(file => requestCounts.get(new URL(file, baseURL).pathname) ?? 0);
  const settledCounts = requestsForScene();
  // Stay with the still-failing illustration across two more retry windows.
  await page.waitForTimeout(3000);
  expect(requestsForScene()).toEqual(settledCounts);
  expect(versions('portrait/19.webp')).toBe(2);
  expect(versions('portrait/preview/19.webp')).toBe(2);
  expect(await end.locator('.passage').textContent()).toBe(oracle.scenes[18].text);
});

test('resizing only the window height keeps the broad-screen reading column on the same paragraph', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openBook(page);
  const passage = page.locator('[data-scene="17"] .beat-text');
  await passage.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(page.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', '17');
  for (const height of [650, 900]) {
    await page.setViewportSize({ width: 1440, height });
    await expect.poll(() => passage.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2);
    })).toBeLessThan(5);
  }
});
