import { expect, type Locator } from '@playwright/test';
import { expectImageFailures, openBook, oracle, sceneAt, test, visitScene } from './reader-harness';

const portrait = { width: 393, height: 852 };
const landscape = { width: 852, height: 393 };

function centerFraction(element: Locator) {
  return element.evaluate(el => {
    const box = el.getBoundingClientRect();
    return (innerHeight / 2 - box.top) / box.height;
  });
}

test('first rotation from a late landscape scene maps the whole scene, then restores the portrait beat', async ({ page }) => {
  await page.setViewportSize(landscape);
  await openBook(page);
  const scene = sceneAt(page, 8);
  await scene.evaluate(el => {
    const box = el.getBoundingClientRect();
    scrollBy({ top: box.top + .88 * box.height - innerHeight / 2, behavior: 'instant' });
  });
  await expect(page.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', '8');
  const previousFraction = await centerFraction(scene);
  await page.setViewportSize(portrait);
  const second = scene.locator('[data-beat="2"]');
  await expect(second).toHaveCount(1);
  await expect.poll(async () => Math.abs(await centerFraction(scene) - previousFraction)).toBeLessThan(.035);
  expect(await centerFraction(second)).toBeGreaterThan(0);
  await test.info().attach('first-rotation.json', { body: JSON.stringify({ landscape: previousFraction, portrait: await centerFraction(scene) }), contentType: 'application/json' });
  // User scrolls a little farther into the portrait answer before rotating back.
  await second.evaluate(el => {
    const box = el.getBoundingClientRect();
    scrollBy({ top: box.top + .64 * box.height - innerHeight / 2, behavior: 'instant' });
  });
  await expect.poll(() => centerFraction(second)).toBeCloseTo(.64, 2);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.setViewportSize(landscape);
  await expect(second).toHaveCount(0);
  await page.setViewportSize(portrait);
  await expect.poll(() => centerFraction(second)).toBeCloseTo(.64, 2);
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
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(oracle.scenes[10].width);
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
  const failures = [12, 19].flatMap(id => ['portrait', 'art'].map(folder => new URL(`${folder}/${id}.webp`, baseURL).href));
  expectImageFailures(page, failures);
  const attempts = new Map<string, Set<string>>();
  let recovered = false;
  await page.route(/\/(?:portrait|art)\/(?:12|19)\.webp(?:\?.*)?$/, route => {
    const url = new URL(route.request().url());
    const versions = attempts.get(url.pathname) ?? new Set<string>();
    versions.add(url.search); attempts.set(url.pathname, versions);
    if (url.pathname.endsWith('/12.webp') && recovered) return route.continue();
    return route.fulfill({ status: 503, body: 'temporarily unavailable' });
  });
  const versions = (file: string) => attempts.get(new URL(file, baseURL).pathname)?.size ?? 0;
  await openBook(page);
  const scene = await visitScene(page, 12);
  const picture = scene.locator('.scene-image');
  await expect.poll(() => versions('art/12.webp')).toBe(1);
  const y = await page.evaluate(() => scrollY);
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  recovered = true;
  // An HTTP 503 does not change navigator.onLine or dispatch an online event.
  await expect.poll(() => picture.evaluate((el: HTMLImageElement) => el.naturalWidth > 0 && el.currentSrc.includes('/portrait/12.webp'))).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(y);
  expect(await scene.locator('.passage').textContent()).toBe(oracle.scenes[11].text);
  expect(versions('portrait/19.webp')).toBe(0);
  const end = await visitScene(page, 19);
  await expect.poll(() => versions('art/19.webp')).toBe(2);
  // Stay with the still-failing illustration across two more retry windows.
  await page.waitForTimeout(3000);
  expect(versions('portrait/19.webp')).toBe(2);
  expect(versions('art/19.webp')).toBe(2);
  expect(await end.locator('.passage').textContent()).toBe(oracle.scenes[18].text);
});
