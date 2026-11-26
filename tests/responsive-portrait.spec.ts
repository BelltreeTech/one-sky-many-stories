import { expect, type Locator } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { captureFrame, deployPath, expectNoOverflow, openBook, oracle, screenshots, test, visitScene } from './reader-harness';

const layoutSizes: Record<string, Array<[number, number]>> = {
  'iphone-webkit': [[393, 852], [852, 393], [375, 667]],
  'ipad-webkit': [[834, 1194], [1024, 768], [1194, 834]],
  'desktop-chromium': [[1440, 900], [1920, 1080], [1280, 320]],
};

function visiblePortrait(image: Locator) {
  return image.evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    // Allow the decoded scene to be painted before scrolling to its successor.
    await new Promise<void>(ready => requestAnimationFrame(() => requestAnimationFrame(() => ready())));
    const frame = img.getBoundingClientRect();
    const stage = img.closest('.portrait-stage')!.getBoundingClientRect();
    let clipped = Math.max(0, stage.left - frame.left, frame.right - stage.right, stage.top - frame.top, frame.bottom - stage.bottom);
    const clips = (overflow: string) => /^(hidden|clip|auto|scroll)$/.test(overflow);
    for (let box = img.parentElement; box && box !== document.body; box = box.parentElement) {
      const style = getComputedStyle(box);
      if (!clips(style.overflowX) && !clips(style.overflowY)) continue;
      const bounds = box.getBoundingClientRect();
      const left = bounds.left + box.clientLeft, top = bounds.top + box.clientTop;
      if (clips(style.overflowX)) clipped = Math.max(clipped, left - frame.left, frame.right - left - box.clientWidth);
      if (clips(style.overflowY)) clipped = Math.max(clipped, top - frame.top, frame.bottom - top - box.clientHeight);
    }
    return {
      url: new URL(img.currentSrc).pathname, natural: [img.naturalWidth, img.naturalHeight],
      width: frame.width, height: frame.height, fit: getComputedStyle(img).objectFit,
      // Artwork may extend beyond the physical viewport: native scrolling must
      // expose the entire portrait, without a shorter clipping panel inside the document.
      clipped,
      rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
      center: frame.left + frame.width / 2, viewportCenter: document.documentElement.clientWidth / 2,
    };
  });
}

// Each viewport starts in Playwright's own fresh context, including its cache,
// viewport history, browser-error checks and trace.
for (const [index, shape] of ['reference viewport', 'landscape viewport', 'resized viewport'].entries()) {
  test('all twenty vertical illustrations keep their composition in the ' + shape, async ({ page, browserName }, info) => {
    const [width, height] = layoutSizes[info.project.name][index];
    const measurements = [];
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height });
    await openBook(page);
    await expect(page.locator('[data-beat] .beat-text')).toHaveCount(23);
    for (const { id } of oracle.scenes) {
      const scene = await visitScene(page, id);
      const image = scene.locator('.scene-image');
      await expect(image).toHaveAttribute('src', /\/portrait\/\d{2}\.webp$/);
      const m = await visiblePortrait(image);
      const where = width + '×' + height + ' scene ' + id;
      expect(m.url, where).toBe(deployPath + 'portrait/' + String(id).padStart(2, '0') + '.webp');
      expect(m.fit, where).toBe('contain');
      expect(m.height, where).toBeGreaterThan(m.width);
      expect(m.width, where).toBeGreaterThan(Math.min(245, width * .6));
      if (width >= 650) {
        expect(m.width, where + ' reading column width').toBeLessThanOrEqual(41 * m.rootFontSize + 1);
      }
      expect(Math.abs(m.width - m.height * m.natural[0] / m.natural[1]), where + ' source aspect ratio').toBeLessThan(2);
      expect(m.clipped, where + ' all four image edges fit their clipping ancestors').toBeLessThan(2);
      expect(Math.abs(m.center - m.viewportCenter), where + ' single centered column').toBeLessThan(2);
      measurements.push({ width, height, scene: id, paintedWidth: m.width, paintedHeight: m.height });
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const fifth = await visitScene(page, 5);
    const normal = await visiblePortrait(fifth.locator('.scene-image'));
    expect(normal.height).toBeGreaterThan(normal.width);
    expect(normal.clipped, 'Scene 5 also keeps its portrait framing with camera motion enabled').toBeLessThan(2);
    await captureFrame(page, 'scene-05-' + width + 'x' + height);
    const geometry = () => fifth.evaluate(el => ({ y: scrollY, art: el.querySelector('.portrait-stage')!.getBoundingClientRect().top,
      text: el.querySelector('.beat-text')!.getBoundingClientRect().top }));
    const initial = await geometry();
    if (browserName === 'chromium') await page.mouse.wheel(0, 128);
    else await page.keyboard.press('PageDown');
    await expect.poll(async () => (await geometry()).y).toBeGreaterThan(initial.y + 8);
    const advanced = await geometry();
    for (const field of ['art', 'text'] as const) {
      expect(Math.abs((initial[field] - advanced[field]) - (advanced.y - initial.y))).toBeLessThan(2);
    }
    if (browserName === 'chromium') await page.mouse.wheel(0, -128);
    else await page.keyboard.press('PageUp');
    await expect.poll(async () => (await geometry()).y).toBeLessThan(advanced.y - 8);
    // A shallow landscape window may show only part of a paragraph. Both
    // ends must be accessible by vertical scrolling at the default text size.
    const textEnds = await fifth.locator('.beat-text').evaluate(el => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = [...range.getClientRects()].filter(line => line.width && line.height);
      return [lines[0].top + scrollY, lines[lines.length - 1].bottom + scrollY];
    });
    for (const y of textEnds) {
      await page.evaluate(documentY => scrollTo({ top: documentY - innerHeight / 2, behavior: 'instant' }), y);
      expect(await page.evaluate(documentY => documentY - scrollY > 0 && documentY - scrollY < innerHeight, y)).toBe(true);
    }
    expect(await fifth.locator('.passage').textContent()).toBe(oracle.scenes[4].text);
    await expectNoOverflow(page);
    const evidence = path.join(screenshots, 'portrait-layouts-' + info.project.name + '-' + width + 'x' + height + '.json');
    await writeFile(evidence, JSON.stringify(measurements, null, 2));
    await info.attach('portrait-layouts.json', { path: evidence, contentType: 'application/json' });
  });
}

test('all twenty small previews keep the composition, description and text of their full portrait', async ({ page }) => {
  test.setTimeout(150_000);
  await openBook(page);
  const descriptions = await page.locator('img.scene-image').evaluateAll(images => images.map(img => (img as HTMLImageElement).alt));
  const failed = new Set<string>();
  await page.route(/\/portrait\/\d{2}\.webp(?:\?.*)?$/, route => {
    failed.add(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 200, contentType: 'image/webp', body: 'invalid WebP bytes' });
  });
  await openBook(page);
  for (const { id, text } of oracle.scenes) {
    const scene = await visitScene(page, id);
    const name = String(id).padStart(2, '0') + '.webp';
    const image = scene.locator('.scene-image');
    await expect(image).toHaveAttribute('data-fallback', 'true');
    await expect(image).toHaveAttribute('src', deployPath + 'portrait/preview/' + name);
    const full = await readFile('public/portrait/' + name);
    const measured = await image.evaluate(async (small: HTMLImageElement, bytes) => {
      const original = new Image();
      original.src = 'data:image/webp;base64,' + bytes;
      await Promise.all([original.decode(), small.decode()]);
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.canvas.width = 48;
      ctx.canvas.height = Math.round(48 * original.naturalHeight / original.naturalWidth);
      const samples = (picture: HTMLImageElement) => {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(picture, 0, 0, ctx.canvas.width, ctx.canvas.height);
        return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height).data;
      };
      const a = samples(original), b = samples(small);
      let sum = 0, maxAlphaDifference = 0;
      for (let i = 0; i < a.length; i += 4) {
        maxAlphaDifference = Math.max(maxAlphaDifference, Math.abs(a[i + 3] - b[i + 3]));
        for (let channel = 0; channel < 3; channel++) sum += Math.abs(a[i + channel] - b[i + channel]);
      }
      return { width: small.naturalWidth, height: small.naturalHeight, projectedHeight: small.naturalWidth * original.naturalHeight / original.naturalWidth,
        maxAlphaDifference, colorDifference: sum / (ctx.canvas.width * ctx.canvas.height * 3) };
    }, full.toString('base64'));
    expect(measured.width).toBe(360);
    expect(Math.abs(measured.height - measured.projectedHeight)).toBeLessThanOrEqual(1);
    // Average RGB difference (0–255) allows WebP compression and resampling,
    // and rejects an unrelated illustration with an identical aspect ratio.
    expect(measured.colorDifference, 'Preview composition on scene ' + id).toBeLessThan(18);
    expect(measured.maxAlphaDifference, 'Preview opacity on scene ' + id).toBeLessThanOrEqual(1);
    await expect(image).toHaveAccessibleName(descriptions[id - 1]);
    expect(await scene.locator('.passage').textContent()).toBe(text);
  }
  expect(failed.size).toBe(20);
});
