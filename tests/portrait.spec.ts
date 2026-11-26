import { expect, type Locator } from '@playwright/test';
import { test, openBook, oracle, deployPath, sceneAt, visitScene, readAt, passageReadable, expectReadable, expectImageFailures, captureFrame } from './reader-harness';

declare global {
  interface Window {
    __readingPositions?: number[];
  }
}

test.describe('portrait discoveries', () => {
  test.beforeEach(async ({ page }, info) => {
    if (info.project.name === 'desktop-chromium') await page.setViewportSize({ width: 393, height: 852 });
  });

  test('read-along moves through the illustration and honors rapid changes of direction', async ({ page }) => {
    await openBook(page);
    const scene = await visitScene(page, 8);
    const first = scene.locator('[data-beat="1"]');
    const second = scene.locator('[data-beat="2"]');
    const documentY = (anchor: Locator) => anchor.evaluate(el => Math.round(el.getBoundingClientRect().top + scrollY));
    const start = await documentY(first);
    const target = await documentY(second);
    await readAt(first.locator('.beat-text'));
    const dock = page.getByRole('navigation', { name: '読み聞かせの操作' });
    await dock.getByRole('button', { name: 'このページから読み始める' }).click();
    const next = dock.getByRole('button', { name: '次へ' });
    const previous = dock.getByRole('button', { name: '前へ' });
    await page.evaluate(() => {
      window.__readingPositions = [];
      window.addEventListener('scroll', () => window.__readingPositions!.push(scrollY), { passive: true });
    });
    await next.click();
    await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(target);
    const positions = await page.evaluate(() => window.__readingPositions!);
    expect(positions.some(y => y > start + 2 && y < target - 2), 'The visible lens approach is not jumped over').toBe(true);
    await expect.poll(() => passageReadable(second.locator('.beat-text'))).toBe(true);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await previous.click();
    const reducedPosition = await page.evaluate(() => new Promise<number>(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(Math.round(scrollY))))));
    expect(reducedPosition, 'Reduced Motion navigation goes straight to the requested text').toBe(start);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const counting = await visitScene(page, 7);
    await readAt(counting.locator('[data-beat="1"] .beat-text'));
    const final = await documentY(counting.locator('[data-beat="2"]'));
    await next.click();
    await next.click();
    await previous.click();
    await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(final);
    await expect.poll(() => passageReadable(counting.locator('[data-beat="2"] .beat-text'))).toBe(true);
  });

  test('a reader may pause at Luna’s question and reverse from Leo’s reply', async ({ page }) => {
    await openBook(page);
    const scene = await visitScene(page, 11);
    const question = scene.locator('[data-beat="1"] .beat-text');
    const reply = scene.locator('[data-beat="2"] .beat-text');
    const camera = scene.locator('.camera');
    await readAt(question);
    const whereAsked = await page.evaluate(() => scrollY);
    expect(await passageReadable(reply), 'The answer waits for the next scroll').toBe(false);
    await readAt(reply);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(whereAsked);
    expect(await passageReadable(question)).toBe(false);
    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), whereAsked);
    await expect.poll(() => passageReadable(question)).toBe(true);
    expect(await passageReadable(reply)).toBe(false);
    const rest = await scene.evaluate(async el => {
      const camera = el.querySelector('.camera')!;
      const edges = [...el.querySelectorAll('.afterglow i')];
      const samples: number[] = [];
      const cameras: number[][] = [];
      const begin = performance.now();
      window.scrollBy({ top: 35, behavior: 'instant' });
      await new Promise<void>(resolve => {
        function capture() {
          const delta = performance.now() - begin;
          const displacement = edges.map(edge => {
            const matrix = new DOMMatrixReadOnly(getComputedStyle(edge).transform);
            return Math.hypot(matrix.m41, matrix.m42);
          });
          samples.push(Math.max(0, ...displacement));
          if (delta > 120) {
            const matrix = new DOMMatrixReadOnly(getComputedStyle(camera).transform);
            cameras.push([matrix.m41, matrix.m42, matrix.a * innerWidth, matrix.d * innerHeight]);
          }
          if (delta > 1200) resolve();
          else requestAnimationFrame(capture);
        }
        requestAnimationFrame(capture);
      });
      const cameraDrift = Math.max(...cameras.flatMap(sample => sample.map((value, index) => Math.abs(value - cameras[0][index]))));
      return { edges: edges.length, peak: Math.max(...samples), last: samples.at(-1)!, cameraDrift, y: scrollY };
    });
    expect(rest.edges).toBeGreaterThan(0);
    expect(rest.peak, 'Secondary movement follows the scroll').toBeGreaterThan(0.02);
    expect(rest.last, 'The residual movement settles completely').toBeLessThan(0.01);
    expect(rest.cameraDrift, 'Camera drift while hair and sleeves settle (CSS pixels)').toBeLessThan(0.1);
    expect(rest.y).toBe(whereAsked + 35);
    expect(await passageReadable(question)).toBe(true);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const text of [question, reply, question]) await readAt(text);
    expect(await camera.evaluate(el => getComputedStyle(el).transform)).toBe('none');
    await expect(page.locator('canvas[data-running]')).toHaveAttribute('data-running', 'false');
  });

  test('both sides of the telescope are readable and reversible even with reduced motion', async ({ page }) => {
    await openBook(page);
    const scene = await visitScene(page, 8);
    const first = scene.locator('[data-beat="1"] .beat-text');
    const second = scene.locator('[data-beat="2"] .beat-text');
    const lens = scene.locator('.telescope-view');
    const lensOpacity = () => lens.evaluate(el => Number(getComputedStyle(el).opacity));
    for (const motion of ['no-preference', 'reduce'] as const) {
      await page.emulateMedia({ reducedMotion: motion });
      await readAt(first);
      const startY = await page.evaluate(() => scrollY);
      await expect.poll(lensOpacity, 'The first frame shows the hillside, before the telescope view').toBeLessThan(0.5);
      await readAt(second);
      await expect.poll(lensOpacity, 'The telescope image appears at the reveal').toBeGreaterThan(0.5);
      const lastY = await page.evaluate(() => scrollY);
      expect(lastY).toBeGreaterThan(startY);
      await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), startY);
      await expect.poll(() => passageReadable(first)).toBe(true);
      await expect.poll(lensOpacity).toBeLessThan(0.5);
    }
  });

  test('the book blends into the Greek hillside without two visible groups of sisters', async ({ page }, info) => {
    await openBook(page);
    const myth = await visitScene(page, 10);
    const reading = sceneAt(page, 9);
    const exposure = (scene: Locator) => scene.locator('.camera').evaluate(camera => {
      let opacity = 1;
      for (let el: Element | null = camera; el; el = el.parentElement) {
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return 0;
        opacity *= Number(style.opacity);
      }
      return opacity;
    });
    async function frame(top: number) {
      await myth.evaluate((element, at) => {
        window.scrollBy({ top: element.getBoundingClientRect().top - innerHeight * at, behavior: 'instant' });
        return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      }, top);
      return Promise.all([exposure(reading), exposure(myth)]);
    }
    const start = await frame(0.84);
    expect(start[0]).toBeGreaterThan(0.85);
    for (const top of [0.71, 0.60, 0.50, 0.40, 0.29]) {
      const opacity = await frame(top);
      expect(Math.min(...opacity), 'The outgoing and incoming groups are not superimposed').toBeLessThan(0.08);
      if (top === 0.50) {
        const ridge = reading.locator('.ridge-bridge');
        await expect(ridge).toHaveAttribute('data-ready', 'true');
        await expect.poll(() => ridge.evaluate(el => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.85);
        if (info.project.name === 'iphone-webkit') await captureFrame(page, 'iphone-09-to-10');
      }
    }
    const end = await frame(0.16);
    expect(end[1]).toBeGreaterThan(0.85);
    const back = await frame(0.84);
    expect(back[0]).toBeCloseTo(start[0], 2);
  });

  test('art recovers in place after both portrait and landscape return a temporary 503', async ({ page, baseURL }) => {
    const files = ['portrait/12.webp', 'art/12.webp'].map(path => new URL(path, baseURL).href);
    expectImageFailures(page, files);
    const failed = new Set<string>();
    let available = false;
    await page.route(/\/(?:art|portrait)\/12\.webp$/, route => {
      if (available) return route.continue();
      failed.add(route.request().url());
      return route.fulfill({ status: 503, contentType: 'text/plain', headers: { 'cache-control': 'no-store' }, body: 'temporarily unavailable' });
    });
    await openBook(page);
    const scene = await visitScene(page, 12);
    await expectReadable(scene);
    await expect.poll(() => failed.size).toBe(2);
    const picture = scene.locator('.scene-image');
    await expect.poll(() => picture.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(0);
    expect(await scene.locator('.passage').textContent()).toBe(oracle.scenes[11].text);
    const initialScroll = await page.evaluate(() => scrollY);
    available = true;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect.poll(() => picture.evaluate((el: HTMLImageElement) =>
      el.naturalWidth > 0 && new URL(el.currentSrc).pathname)).toBe(new URL(files[0]).pathname);
    await picture.evaluate(async (el: HTMLImageElement) => { await el.decode(); });
    expect(await page.evaluate(() => scrollY)).toBe(initialScroll);
    expect(await scene.locator('.passage').textContent()).toBe(oracle.scenes[11].text);
    await expect.poll(() => passageReadable(scene.locator('.passage'))).toBe(true);
  });

  test('unreadable portrait and auxiliary images preserve the illustration and original English', async ({ page }) => {
    const failures = new Set<string>();
    await page.route(/\/portrait\/(?:11|telescope|ridge)\.webp$/, route => {
      failures.add(new URL(route.request().url()).pathname.split('/').pop()!);
      // A 200 response with invalid bytes exercises image decode failures, even
      // when the resource is cached successfully by a CDN or service worker.
      return route.fulfill({ status: 200, contentType: 'image/webp', body: 'invalid WebP bytes' });
    });
    await openBook(page);
    const scene = await visitScene(page, 8);
    for (const beat of [1, 2, 1]) await readAt(scene.locator('[data-beat="' + beat + '"] .beat-text'));
    await expect.poll(() => failures.has('telescope.webp')).toBe(true);
    await expect.poll(() => scene.locator('.scene-image').evaluate((el: HTMLImageElement) =>
      el.naturalWidth > 0 && new URL(el.currentSrc).pathname)).toBe(deployPath + 'portrait/08.webp');
    const overlay = scene.locator('.telescope-view');
    if (await overlay.count()) {
      expect(await overlay.evaluate(el => !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        || getComputedStyle(el).opacity === '0')).toBe(true);
    }
    expect(await scene.locator('.passage').textContent()).toBe(oracle.scenes[7].text);
    const book = await visitScene(page, 9);
    await expectReadable(book);
    await expect(book.locator('.ridge-bridge')).toHaveCSS('opacity', '0');
    expect(await book.locator('.passage').textContent()).toBe(oracle.scenes[8].text);
    const sisters = await visitScene(page, 11);
    for (const beat of [1, 2]) await readAt(sisters.locator('[data-beat="' + beat + '"] .beat-text'));
    await expect.poll(() => [...failures].sort()).toEqual(['11.webp', 'ridge.webp', 'telescope.webp']);
    await expect.poll(() => sisters.locator('.scene-image').evaluate((el: HTMLImageElement) => ({
      url: el.currentSrc && new URL(el.currentSrc).pathname,
      width: el.naturalWidth,
    }))).toEqual({ url: deployPath + 'art/11.webp', width: oracle.scenes[10].width });
    expect(await sisters.locator('.passage').textContent()).toBe(oracle.scenes[10].text);
    await expectReadable(await visitScene(page, 20));
  });
});
