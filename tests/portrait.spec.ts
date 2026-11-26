import { expect, type Locator } from '@playwright/test';
import { test, openBook, oracle, deployPath, sceneAt, visitScene, readAt, passageReadable, expectReadable, expectImageFailures, captureFrame } from './reader-harness';

// The optical panel conveys the encounter with fainter stars, even before its pixels arrive.
const opticalDescription = /through the eyepiece.*bright stars.*fainter points of light/i;

test.describe('portrait discoveries', () => {
  test.beforeEach(async ({ page }, info) => {
    if (info.project.name === 'desktop-chromium') await page.setViewportSize({ width: 393, height: 852 });
  });

  test('native scrolling carries portraits and words together without snapping to a page', async ({ page, browserName }) => {
    await openBook(page);
    const scene = await visitScene(page, 6);
    const geometry = () => scene.evaluate(section => {
      const art = section.querySelector('.portrait-stage')!;
      const text = section.querySelector('.beat-text')!;
      return { y: scrollY, art: art.getBoundingClientRect().top, text: text.getBoundingClientRect().top,
        snap: [document.documentElement, document.body].map(el => getComputedStyle(el).scrollSnapType),
        mode: getComputedStyle(art).position };
    });
    const settle = () => page.evaluate(() => new Promise<void>(resolve => {
      let last = scrollY, repeated = 0;
      function frame() {
        repeated = Math.abs(scrollY - last) < .1 ? repeated + 1 : 0;
        last = scrollY;
        if (repeated >= 8) resolve();
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }));
    const before = await geometry();
    expect(before.snap).toEqual(['none', 'none']);
    expect(['fixed', 'sticky']).not.toContain(before.mode);
    if (browserName === 'chromium') {
      await page.mouse.move(180, 400);
      await page.mouse.wheel(0, 147);
    } else {
      // Mobile WebKit exposes native hardware keyboard page scrolling through
      // Playwright, but rejects mouse.wheel. UIKit swipe QA is recorded separately.
      await page.keyboard.press('PageDown');
    }
    await expect.poll(async () => (await geometry()).y).toBeGreaterThan(before.y + 10);
    await settle();
    const after = await geometry();
    const delta = after.y - before.y;
    expect(Math.abs((before.art - after.art) - delta)).toBeLessThan(2);
    expect(Math.abs((before.text - after.text) - delta)).toBeLessThan(2);
    await page.waitForTimeout(250);
    expect((await geometry()).y).toBe(after.y);
    if (browserName === 'chromium') await page.mouse.wheel(0, -147);
    else await page.keyboard.press('PageUp');
    await expect.poll(async () => (await geometry()).y).toBeLessThan(after.y - 10);
    await settle();
    // Compare the same physical scroll position in both directions. Inertial
    // input devices need not travel an identical distance for the opposite stroke.
    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), before.y);
    const back = await geometry();
    expect(Math.abs(back.art - before.art)).toBeLessThan(2);
    expect(Math.abs(back.text - before.text)).toBeLessThan(2);
    if (browserName === 'chromium') {
      // Chromium's device protocol supplies trusted touch input and native
      // panning. Dispatching DOM TouchEvents alone cannot scroll the browser.
      const touch = await page.context().newCDPSession(page);
      await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
      async function swipe(from: number, to: number) {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 152, y: from }] });
        for (let i = 1; i <= 8; i++) {
          await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 152, y: from + (to - from) * i / 8 }] });
          await page.waitForTimeout(24);
        }
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await settle();
      }
      try {
        await swipe(530, 390);
        const upward = await geometry();
        expect(upward.y).toBeGreaterThan(back.y + 40);
        expect(Math.abs((back.art - upward.art) - (upward.y - back.y))).toBeLessThan(2);
        await swipe(390, 530);
        expect((await geometry()).y).toBeLessThan(upward.y - 40);
      } finally {
        await touch.detach();
      }
    }
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
    await scene.locator('.portrait-stage').evaluate(art => art.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const rest = await scene.evaluate(async el => {
      const camera = el.querySelector('.camera')!;
      const wind = el.querySelector<HTMLElement>('.afterglow')!;
      const edges = [...wind.querySelectorAll('i')];
      const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const amplitude = () => Math.max(0, ...edges.map(edge => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(edge).transform);
        return Math.hypot(matrix.m41, matrix.m42);
      }));
      const cameraPosition = () => {
        const m = new DOMMatrixReadOnly(getComputedStyle(camera).transform);
        return [m.m41, m.m42, m.a * innerWidth, m.d * innerHeight];
      };
      // Keep the finger moving over multiple paints. A single 35px jump can
      // begin and end between two WebKit paints on a headless Linux runner.
      await frame();
      await frame();
      const initialY = scrollY;
      let travelled = 0, peak = 0, moving = false;
      const interval = setInterval(() => {
        window.scrollBy({ top: 2, behavior: 'instant' });
        travelled += 2;
      }, 20);
      try {
        const until = performance.now() + 650;
        while (performance.now() < until) {
          await frame();
          moving ||= wind.dataset.wind === 'up';
          peak = Math.max(peak, amplitude());
        }
      } finally {
        clearInterval(interval);
      }
      await frame();
      await frame();
      const stopY = scrollY;
      const start = cameraPosition();
      const until = performance.now() + 1300;
      let cameraDrift = 0;
      const tail = [amplitude()];
      while (performance.now() < until) {
        await frame();
        tail.push(amplitude());
        const now = cameraPosition();
        cameraDrift = Math.max(cameraDrift, ...now.map((v, i) => Math.abs(v - start[i])));
      }
      return { peak, moving, tail, last: amplitude(), wind: wind.dataset.wind, cameraDrift, initialY, travelled, stopY, endY: scrollY };
    });
    expect(rest.moving, 'The scroll activated the secondary movement').toBe(true);
    expect(rest.peak, 'Clouds, hair or sleeves visibly moved').toBeGreaterThan(0.02);
    const tailPeak = Math.max(...rest.tail);
    expect(rest.tail.some(value => value > .01 && value < tailPeak - .01),
      'A painted edge is still moving through intermediate positions after the camera stops').toBe(true);
    expect(rest.wind).toBe('still');
    expect(rest.last, 'The residual movement settles completely').toBeLessThan(0.01);
    expect(rest.cameraDrift, 'Camera drift once scrolling ended (CSS pixels)').toBeLessThan(0.1);
    expect(rest.stopY).toBe(rest.initialY + rest.travelled);
    expect(rest.endY).toBe(rest.stopY);
    await readAt(question);
    expect(await page.evaluate(() => scrollY)).toBe(whereAsked);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const text of [question, reply, question]) await readAt(text);
    expect(await camera.evaluate(el => getComputedStyle(el).transform)).toBe('none');
    await expect(page.locator('canvas[data-running]')).toHaveAttribute('data-running', 'false');
  });

  test('both telescope views form successive, reversible panels in the document', async ({ page }) => {
    await openBook(page);
    const scene = await visitScene(page, 8);
    const first = scene.locator('[data-beat="1"] .beat-text');
    const answer = scene.locator('[data-beat="2"] .beat-text');
    const lens = scene.locator('.lens-field .telescope-view');
    await expect(scene.locator('[data-beat="1"]').getByRole('img', { name: opticalDescription })).toHaveCount(0);
    await expect(scene.locator('[data-beat="2"]').getByRole('img', { name: opticalDescription })).toHaveCount(1);
    expect(await scene.locator('.passage').textContent()).toBe(oracle.scenes[7].text);
    for (const motion of ['no-preference', 'reduce'] as const) {
      await page.emulateMedia({ reducedMotion: motion });
      await readAt(first);
      const firstY = await page.evaluate(() => scrollY);
      await lens.evaluate(async (el: HTMLImageElement) => { await el.decode(); });
      const rows = await scene.evaluate(section => {
        const rect = (sel: string) => section.querySelector(sel)!.getBoundingClientRect();
        const art = rect('.portrait-stage');
        const lens = rect('.lens-field');
        return { hill: art.top + scrollY, field: lens.top + scrollY, above: art.bottom <= lens.top + 1 };
      });
      expect(rows.above).toBe(true);
      expect(rows.field).toBeGreaterThan(rows.hill);
      await readAt(answer);
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(firstY + 20);
      await expect(lens).toHaveAttribute('data-ready', 'true');
      await readAt(first);
      expect(await page.evaluate(() => scrollY)).toBe(firstY);
    }
  });

  test('two neighboring scenes share the screen and the mythical hillside has its own artwork', async ({ page }, info) => {
    await openBook(page);
    const next = await visitScene(page, 10);
    const previous = sceneAt(page, 9);
    await next.evaluate(section => {
      window.scrollBy({ top: section.getBoundingClientRect().top - innerHeight * .52, behavior: 'instant' });
      return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    const visibleContent = (scene: Locator) => scene.evaluate(section => {
      const inFrame = (r: DOMRect) => r.top < innerHeight - 8 && r.bottom > 8 && r.width > 10 && r.height > 0;
      const text = [...section.querySelectorAll('.beat-text, h2')].filter(e => {
        const r = e.getBoundingClientRect();
        return inFrame(r) && r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden';
      });
      const image = [...section.querySelectorAll('img')].filter(e => {
        if (!e.complete || !e.naturalWidth || !inFrame(e.getBoundingClientRect())) return false;
        for (let a: Element | null = e; a; a = a.parentElement) {
          const style = getComputedStyle(a);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.1) return false;
        }
        return true;
      });
      return text.length + image.length;
    });
    await expect.poll(() => visibleContent(previous)).toBeGreaterThan(0);
    await expect.poll(() => visibleContent(next)).toBeGreaterThan(0);
    const ridge = next.locator('.ridge-alignment .ridge-bridge');
    await expect(ridge).toHaveAttribute('data-ready', 'true');
    const order = await page.evaluate(() => {
      const main = (id: number) => document.querySelector('[data-scene="'+id+'"] .scene-image')!.getBoundingClientRect();
      const ridge = document.querySelector('[data-scene="10"] .ridge-bridge')!.getBoundingClientRect();
      return [main(9).bottom <= ridge.top + 1, ridge.bottom <= main(10).top + 1];
    });
    expect(order[0], 'The outdoor panel follows the story told over the open book').toBe(true);
    // A feathered seam may overlap a few background pixels. The two groups
    // of sisters must still occupy distinct illustrations in the strip.
    const overlap = await next.evaluate(el => {
      const ridge = el.querySelector('.ridge-bridge')!.getBoundingClientRect();
      const art = el.querySelector('.scene-image')!.getBoundingClientRect();
      return Math.max(0, ridge.bottom - art.top) / art.height;
    });
    expect(overlap).toBeLessThan(0.10);
    if (info.project.name === 'iphone-webkit') await captureFrame(page, 'iphone-09-to-10');
  });

  test('art recovers in place after both portrait and landscape return a temporary 503', async ({ page, baseURL }) => {
    const files = ['portrait/12.webp', 'art/12.webp'].map(path => new URL(path, baseURL).href);
    expectImageFailures(page, files);
    const failed = new Set<string>();
    let available = false;
    await page.route(/\/(?:art|portrait)\/12\.webp(?:\?.*)?$/, route => {
      if (available) return route.continue();
      const url = new URL(route.request().url());
      failed.add(url.origin + url.pathname);
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
    await page.route(/\/portrait\/(?:11|telescope|ridge)\.webp(?:\?.*)?$/, route => {
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
    await expect(scene.locator('[data-beat="2"]').getByRole('img', { name: opticalDescription })).toHaveCount(1);
    if (await overlay.count()) {
      expect(await overlay.evaluate(el => !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        || getComputedStyle(el).opacity === '0')).toBe(true);
    }
    expect(await scene.locator('.passage').textContent()).toBe(oracle.scenes[7].text);
    const book = await visitScene(page, 10);
    await expectReadable(book);
    await expect(book.locator('.ridge-bridge')).toHaveCSS('opacity', '0');
    expect(await book.locator('.passage').textContent()).toBe(oracle.scenes[9].text);
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
