import { expect, type Locator, type Page } from '@playwright/test';
import { test, openBook, oracle, deployPath, sceneAt, visitScene, readAt, passageReadable, expectReadable, expectImageFailures, captureFrame } from './reader-harness';

// The optical panel conveys the encounter with fainter stars, even before its pixels arrive.
const opticalDescription = /through the eyepiece.*bright stars.*fainter points of light/i;

async function checkMemoryMask(page: Page, original: Locator) {
  const rect = await original.boundingBox();
  if (!rect) throw new Error('The memory painting must be visible');
  // Compare two exposures at exactly the same camera position. Hide only the
  // changing stars, which otherwise introduce pixel differences unrelated to the memory.
  const still = (opacity: number) => page.screenshot({ scale: 'css',
    style: '.starlight{visibility:hidden!important}.memory-sky{opacity:' + opacity + '!important}' });
  const before = await still(1), after = await still(0);
  const result = await page.evaluate(async ({ a, b, rect }) => {
    const pixels = async (png: string) => {
      const image = new Image();
      image.src = 'data:image/png;base64,' + png;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    };
    const [start, end] = await Promise.all([pixels(a), pixels(b)]);
    let sky = 0, changedSky = 0, foreground = 0, changedForeground = 0;
    for (let y = Math.max(0, Math.ceil(rect.y)); y < Math.min(start.height, rect.y + rect.height); y += 2) {
      for (let x = Math.max(0, Math.ceil(rect.x)); x < Math.min(start.width, rect.x + rect.width); x += 2) {
        const u = (x - rect.x) / rect.width, v = (y - rect.y) / rect.height;
        const i = 4 * (y * start.width + x);
        const different = [0, 1, 2].some(channel => Math.abs(start.data[i + channel] - end.data[i + channel]) > 6);
        if (u > .55 && v < .35) { sky++; if (different) changedSky++; }
        if (v >= .40 || u <= .45) { foreground++; if (different) changedForeground++; }
      }
    }
    return { sky, changedSky, foreground, changedForeground };
  }, { a: before.toString('base64'), b: after.toString('base64'), rect });
  expect(result.sky).toBeGreaterThan(100);
  expect(result.foreground).toBeGreaterThan(100);
  expect(result.changedSky / result.sky, 'The memory appears in the upper-right sky').toBeGreaterThan(.01);
  expect(result.changedForeground / result.foreground, 'The three friends and the left sky stay unchanged').toBeLessThan(.001);
}

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
      const stopY = scrollY;
      const releasedAt = performance.now();
      // Native scrolling may deliver its last ScrollTrigger update after the
      // test callback. Observe the actual rest state before measuring the fixed camera.
      let quietSince = performance.now(), priorCamera = getComputedStyle(camera).transform;
      do {
        await frame();
        const pose = getComputedStyle(camera).transform;
        if (wind.dataset.wind !== 'still' || amplitude() >= .01 || pose !== priorCamera) quietSince = performance.now();
        priorCamera = pose;
      } while (performance.now() - quietSince < 120 && performance.now() - releasedAt < 5000);
      const settledAfter = performance.now() - releasedAt;
      const start = cameraPosition();
      const until = performance.now() + 420;
      let cameraDrift = 0;
      while (performance.now() < until) {
        await frame();
        const now = cameraPosition();
        cameraDrift = Math.max(cameraDrift, ...now.map((v, i) => Math.abs(v - start[i])));
      }
      return { peak, moving, settledAfter, last: amplitude(), wind: wind.dataset.wind, cameraDrift, initialY, travelled, stopY, endY: scrollY };
    });
    await test.info().attach('native-scroll-and-settle.json', { body: JSON.stringify(rest), contentType: 'application/json' });
    expect(rest.moving, 'The scroll activated the secondary movement – ' + JSON.stringify(rest)).toBe(true);
    expect(rest.peak, 'Clouds, hair or sleeves visibly moved').toBeGreaterThan(0.02);
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

  test('the painted motion of a released sleeve or cloud tapers after native scrolling stops', async ({ page }) => {
    // Install the controllable clock before loading this independent page. The
    // ordinary gesture test is allowed to paint with a completely native clock.
    await page.clock.install();
    await openBook(page);
    const scene = await visitScene(page, 11);
    await scene.locator('.portrait-stage').evaluate(stage => stage.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await scene.locator('.scene-image').evaluate(async (image: HTMLImageElement) => { await image.decode(); });
    await expect(scene.locator('.camera')).not.toHaveCSS('transform', 'none');
    await expect(scene.locator('.afterglow')).toBeVisible();
    // On a loaded runner, multiple real-world frames can pass before the test
    // gets a turn. Deliver one final scroll, then advance actual app callbacks
    // in 64 ms steps without another input. Read the painted edge transforms.
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 2000)));
    const impulse = await scene.evaluate(el => {
      const from = scrollY;
      scrollBy({ top: 96, behavior: 'instant' });
      // WebKitGTK can hold the platform scroll event until its next real
      // compositor frame. Deliver the document notification at this clock tick
      // after moving the real viewport. The separate input test uses native events alone.
      document.dispatchEvent(new Event('scroll', { bubbles: true }));
      const stage = el.querySelector('.portrait-stage')!.getBoundingClientRect();
      return { delta: scrollY - from, stageTop: stage.top, stageBottom: stage.bottom, frame: innerHeight,
        wind: el.querySelector<HTMLElement>('.afterglow')!.dataset.wind };
    });
    expect(impulse.delta).toBe(96);
    expect(impulse.stageTop).toBeLessThan(impulse.frame);
    expect(impulse.stageBottom).toBeGreaterThan(0);
    const sample = () => scene.evaluate(el => {
      const edge = el.querySelector('.drifting-cloud')!;
      return { y: scrollY, time: performance.now(), wind: el.querySelector<HTMLElement>('.afterglow')!.dataset.wind,
        camera: getComputedStyle(el.querySelector('.camera')!).transform, offset: Math.abs(new DOMMatrixReadOnly(getComputedStyle(edge).transform).m41) };
    });
    let pulse = await sample();
    for (let i = 0; i < 8 && pulse.offset < .5; i++) {
      await page.clock.runFor(16);
      pulse = await sample();
    }
    expect(pulse.offset, 'A full fingertip stroke moves the cloud visibly – ' + JSON.stringify({ impulse, pulse })).toBeGreaterThan(.5);
    const samples = [];
    for (let i = 0; i < 16; i++) {
      await page.clock.runFor(64);
      samples.push(await sample());
    }
    const timeline = JSON.stringify({ pulse, samples });
    await test.info().attach('stopped-motion-frames.json', { body: timeline, contentType: 'application/json' });
    expect(samples.every(p => p.y === pulse.y && p.camera === pulse.camera), 'Stationary camera – ' + timeline).toBe(true);
    expect(samples.some(p => p.offset > .01 && p.offset < pulse.offset - .01),
      'A painted edge continues through an intermediate position after the camera stops – ' + timeline).toBe(true);
    expect(samples.at(-1)!.offset).toBeLessThan(.01);
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

  test('all nineteen neighboring scenes share the screen at their boundaries', async ({ page }, info) => {
    await openBook(page);
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
    for (let id = 2; id <= 20; id++) {
      await test.step('Join scenes ' + (id - 1) + ' and ' + id, async () => {
        const next = await visitScene(page, id);
        const previous = sceneAt(page, id - 1);
        await next.evaluate(section => {
          window.scrollBy({ top: section.getBoundingClientRect().top - innerHeight * .52, behavior: 'instant' });
          return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        });
        await expect.poll(() => visibleContent(previous)).toBeGreaterThan(0);
        await expect.poll(() => visibleContent(next)).toBeGreaterThan(0);
        const seam = await next.evaluate(section => {
          const prior = section.previousElementSibling!.getBoundingClientRect();
          return Math.abs(prior.bottom - section.getBoundingClientRect().top);
        });
        expect(seam).toBeLessThan(1);
        if (info.project.name === 'iphone-webkit') {
          const label = (n: number) => String(n).padStart(2, '0');
          await captureFrame(page, 'iphone-' + label(id - 1) + '-to-' + label(id));
        }
      });
    }
  });

  test('the memory and the mythical ridge dissolve on the same painting as the reader scrolls', async ({ page }, info) => {
    await openBook(page);
    for (const [id, selector] of [[4, '.memory-sky'], [10, '.ridge-bridge']] as const) {
      const scene = await visitScene(page, id);
      const exposure = scene.locator('.portrait-sheet ' + selector);
      const original = scene.locator('.portrait-sheet .scene-image');
      await expect(exposure).toHaveAttribute('data-ready', 'true');
      await original.evaluate(async (img: HTMLImageElement) => { await img.decode(); });
      const pose = () => exposure.evaluate(img => {
        const base = img.parentElement!.querySelector('.scene-image')!.getBoundingClientRect();
        const painted = img.getBoundingClientRect();
        return { opacity: Number(getComputedStyle(img).opacity), y: scrollY,
          registration: Math.max(...(['top', 'bottom', 'left', 'right'] as const).map(side => Math.abs(base[side] - painted[side]))) };
      });
      // Set the top of the drawing at a known distance from the window top.
      // The effect must be recoverable from position in either direction.
      const seek = async (top: number) => {
        await scene.locator('.portrait-stage').evaluate(async (stage, top) => {
          scrollBy({ top: stage.getBoundingClientRect().top - innerHeight * top, behavior: 'instant' });
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        }, top);
        return pose();
      };
      const entry = await seek(.8), middle = await seek(.27);
      expect(entry.opacity).toBeGreaterThan(.95);
      expect(middle.opacity).toBeGreaterThan(.05);
      expect(middle.opacity).toBeLessThan(.95);
      expect(middle.y).toBeGreaterThan(entry.y);
      await page.waitForTimeout(180);
      expect(await pose()).toEqual(middle);
      if (info.project.name === 'iphone-webkit') await captureFrame(page, 'iphone-' + String(id).padStart(2, '0') + '-dissolve');
      if (id === 4) await checkMemoryMask(page, original);
      const finished = await seek(-.05);
      expect(finished.opacity).toBeLessThan(.05);
      expect(await seek(.27)).toEqual(middle);
      const back = await seek(.8);
      expect(back).toEqual(entry);
      for (const point of [entry, middle, finished, back]) expect(point.registration).toBeLessThan(1);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      for (const top of [.8, .27, -.05]) expect((await seek(top)).opacity).toBe(0);
      expect(await original.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      expect(await scene.locator('.passage').textContent()).toBe(oracle.scenes[id - 1].text);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    }
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
    await page.route(/\/portrait\/(?:11|telescope|ridge|before-memory)\.webp(?:\?.*)?$/, route => {
      failures.add(new URL(route.request().url()).pathname.split('/').pop()!);
      // A 200 response with invalid bytes exercises image decode failures, even
      // when the resource is cached successfully by a CDN or service worker.
      return route.fulfill({ status: 200, contentType: 'image/webp', body: 'invalid WebP bytes' });
    });
    await openBook(page);
    const memory = await visitScene(page, 4);
    await expect.poll(() => failures.has('before-memory.webp')).toBe(true);
    await expect(memory.locator('.memory-sky')).toHaveCSS('opacity', '0');
    expect(await memory.locator('.passage').textContent()).toBe(oracle.scenes[3].text);
    await memory.locator('.scene-image').evaluate(async (img: HTMLImageElement) => { await img.decode(); });
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
    await expect.poll(() => [...failures].sort()).toEqual(['11.webp', 'before-memory.webp', 'ridge.webp', 'telescope.webp']);
    await expect.poll(() => sisters.locator('.scene-image').evaluate((el: HTMLImageElement) => ({
      url: el.currentSrc && new URL(el.currentSrc).pathname,
      width: el.naturalWidth,
    }))).toEqual({ url: deployPath + 'art/11.webp', width: oracle.scenes[10].width });
    expect(await sisters.locator('.passage').textContent()).toBe(oracle.scenes[10].text);
    await expectReadable(await visitScene(page, 20));
  });
});
