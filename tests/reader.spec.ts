import { expect, type Response } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { measureReadingContrast } from './readability';
import { test, type PDFPage, screenshots, deployPath, secondBeat, oracle, openBook, sceneAt, visitScene, readAt, expectReadable, passageReadable, expectNoOverflow, captureFrame } from './reader-harness';

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('the whole opening sentence fits above phone browser chrome without scrolling', async ({ page }) => {
  // iPhone 16 Safari Simulator reports its expanded glass controls at y=769.
  // Reserve 62 px above and 90 below the web view, plus 12 px breathing room.
  const height = 852 - 62 - 90;
  await page.setViewportSize({ width: 393, height });
  await openBook(page);
  const firstSentence = oracle.scenes[0].text.slice(0, oracle.scenes[0].text.indexOf('.') + 1);
  const lines = await sceneAt(page, 1).locator('.beat-text').evaluate((paragraph, sentence) => {
    const node = paragraph.firstChild!;
    if (!node.textContent?.startsWith(sentence)) throw new Error('Opening sentence differs from the PDF');
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, sentence.length);
    return [...range.getClientRects()].map(rect => ({ top: rect.top, bottom: rect.bottom }));
  }, firstSentence);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) {
    expect(line.top).toBeGreaterThanOrEqual(0);
    expect(line.bottom).toBeLessThanOrEqual(height - 12);
  }
});

test('twenty illustrations and passages match the PDF in the production reader', async ({ page }, info) => {
  const isPortrait = info.project.name !== 'desktop-chromium';
  const deviceName = info.project.name === 'ipad-webkit' ? 'ipad' : 'iphone';
  const resources = new Map<string, Response>();
  const measurements: Array<{ scene: number; beat: number } & Awaited<ReturnType<typeof measureReadingContrast>>> = [];
  page.on('response', response => { if (/^https?:/.test(response.url())) resources.set(response.url(), response); });
  await openBook(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('main')).toHaveCount(1);
  const story = JSON.parse(await readFile('src/data/story.json', 'utf8'));
  expect(story.title).toBe(oracle.title);
  expect(story.scenes.map(({ id, text, width, height }: PDFPage) => ({ id, text, width, height }))).toEqual(oracle.scenes);
  expect(oracle.scenes.map(scene => scene.id)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(oracle.title, { ignoreCase: true });
  if (isPortrait) await captureFrame(page, deviceName + '-landing');

  // Late scenes should not already have fetched every original at initial load.
  const illustrationPath = isPortrait ? '/portrait/' : '/art/';
  expect([...resources.keys()].filter(url => url.includes(illustrationPath)).length).toBeLessThan(20);
  for (const source of oracle.scenes) {
    await test.step('Read PDF page ' + source.id, async () => {
      const scene = await visitScene(page, source.id);
      const passage = scene.locator('.passage');
      expect(await passage.textContent(), 'The original text appears once, verbatim and in order').toBe(source.text);
      const beatStart = secondBeat.get(source.id);
      if (isPortrait && beatStart) {
        const boundary = source.text.indexOf(beatStart);
        expect(boundary).toBeGreaterThan(0);
        const beats = passage.locator('[data-beat] .beat-text');
        await expect(beats).toHaveCount(2);
        await expect(beats.nth(0)).toHaveText(source.text.slice(0, boundary).trimEnd());
        await expect(beats.nth(1)).toHaveText(source.text.slice(boundary));
        await readAt(beats.nth(0));
      } else {
        await readAt(passage);
      }
      const mainImage = scene.locator('img.scene-image');
      await expect(mainImage).toHaveAttribute('src', /\.webp$/);
      const asset = await mainImage.evaluate(async (element: HTMLImageElement) => {
        await element.decode();
        return { width: element.naturalWidth, height: element.naturalHeight, url: element.currentSrc, alt: element.alt };
      });
      if (isPortrait) {
        expect(asset.height, 'A portrait composition is displayed on the phone').toBeGreaterThan(asset.width);
        expect(asset.width).toBeGreaterThanOrEqual(393);
      } else {
        expect([asset.width, asset.height]).toEqual([source.width, source.height]);
      }
      expect(asset.alt.trim()).not.toBe('');
      await expect(scene.getByRole('img', { name: asset.alt, exact: true })).toHaveCount(1);
      expect(await passage.evaluate(el => getComputedStyle(el).userSelect)).not.toBe('none');
      const publicFile = isPortrait ? 'portrait/' + String(source.id).padStart(2, '0') + '.webp' : story.scenes[source.id - 1].image;
      expect(new URL(asset.url).pathname).toBe(deployPath + publicFile);
      const served = resources.get(asset.url)!;
      expect(served.headers()['content-type']).toMatch(/^image\/webp\b/);
      expect(sha256(await served.body())).toBe(sha256(await readFile(path.join('public', publicFile))));
      await expectNoOverflow(page);
      if (isPortrait || source.id === 1) {
        const name = isPortrait ? deviceName + '-' + String(source.id).padStart(2, '0') : 'desktop-opening';
        await page.screenshot({ path: path.join(screenshots, name + '.png'), scale: 'css' });
      }
      if (isPortrait) {
        const result = await measureReadingContrast(page, beatStart ? passage.locator('[data-beat="1"] .beat-text') : passage);
        measurements.push({ scene: source.id, beat: 1, ...result });
        expect(result.minimum, 'Visible text against the actual background on scene ' + source.id).toBeGreaterThanOrEqual(4.5);
      }
      if (isPortrait && beatStart) {
        if (source.id === 7 || source.id === 11) {
          await mainImage.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await mainImage.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          await captureFrame(page, deviceName + '-' + String(source.id).padStart(2, '0') + '-art');
        }
        const answer = passage.locator('[data-beat="2"] .beat-text');
        await readAt(answer);
        if (source.id === 8) {
          const lens = scene.locator('.telescope-view');
          await expect(lens).toHaveAttribute('data-ready', 'true');
          await expect.poll(() => lens.evaluate(el => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.99);
        }
        await captureFrame(page, deviceName + '-' + String(source.id).padStart(2, '0') + '-answer');
        const result = await measureReadingContrast(page, answer);
        measurements.push({ scene: source.id, beat: 2, ...result });
        expect(result.minimum, 'Answer text against the actual background on scene ' + source.id).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
  if (isPortrait) {
    await writeFile(path.join(screenshots, deviceName + '-reading-contrast.json'), JSON.stringify(measurements, null, 2) + '\n');
    for (const file of ['portrait/telescope.webp', 'portrait/ridge.webp']) {
      const served = resources.get(new URL(file, page.url()).href);
      expect(served, file + ' was fetched on the reading route').toBeDefined();
      expect(served!.headers()['content-type']).toMatch(/^image\/webp\b/);
      expect(sha256(await served!.body())).toBe(sha256(await readFile(path.join('public', file))));
    }
  }

  const fonts = await page.evaluate(() => [...document.fonts]
    .filter(face => face.status === 'loaded').map(face => face.family.replace(/['"]/g, '')));
  for (const name of ['Cormorant Garamond', 'Cinzel', 'Lora']) {
    expect(fonts, 'Loaded, locally served book faces').toContain(name);
  }
  const base = new URL(page.url());
  const fetched = [...resources.entries()].filter(([url]) => /^https?:/.test(url));
  expect(fetched.filter(([url]) => {
    const parsed = new URL(url);
    return parsed.origin !== base.origin || !parsed.pathname.startsWith(base.pathname);
  }), 'Every production resource resolves under the deployment path').toEqual([]);
  for (const [url, response] of fetched) {
    if (new URL(url).pathname.endsWith('.woff2')) expect(response.headers()['content-type']).toMatch(/font|woff|octet-stream/i);
  }
});

test('fast forward, reverse and changing screen height leave the story readable', async ({ page }) => {
  await openBook(page);
  const view = page.viewportSize()!;
  for (const id of [20, 13, 4, 1, 16]) {
    await expectReadable(await visitScene(page, id));
  }
  const oldScroll = await page.evaluate(() => window.scrollY);
  await page.setViewportSize({ width: view.width, height: view.height - 100 });
  await expectReadable(await visitScene(page, 16));
  await expectNoOverflow(page);
  await page.setViewportSize(view);
  await expectReadable(await visitScene(page, 1));
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(oldScroll);

  // Readers can enlarge their default size. A long paragraph may need normal
  // vertical scrolling, but must stay inside its scene without lateral overflow.
  const longScene = sceneAt(page, 17);
  const originalSize = await longScene.locator('.passage').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await visitScene(page, 17);
  const geometry = await longScene.evaluate(el => {
    const body = el.querySelector('.passage')!;
    const text = body.getBoundingClientRect();
    const section = el.getBoundingClientRect();
    return { font: parseFloat(getComputedStyle(body).fontSize), contained: text.top >= section.top - 1 && text.bottom <= section.bottom + 1 };
  });
  expect(geometry.font).toBeGreaterThan(originalSize);
  expect(geometry.contained).toBe(true);
  await expectNoOverflow(page);
});

test('native scroll moves the active camera and releases distant artwork', async ({ page }) => {
  await openBook(page);
  const scene = await visitScene(page, 6);
  await expectReadable(scene);
  const camera = scene.locator('.camera');
  const transform = () => camera.evaluate(element => getComputedStyle(element).transform);
  const first = await transform();
  await page.evaluate(() => window.scrollBy({ top: Math.round(innerHeight * 0.24), behavior: 'instant' }));
  await expect.poll(transform).not.toBe(first);
  await expectReadable(await visitScene(page, 17));
  await expect(scene.locator('img.scene-image')).not.toHaveAttribute('src', /.+/);
  await expectReadable(await visitScene(page, 6));
  await expect(scene.locator('img.scene-image')).toHaveAttribute('src', /\.webp$/);
});

test('rotating between portrait art and the landscape PDF retains the reading scene', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await openBook(page);
  const scene = await visitScene(page, 17);
  await readAt(scene.locator('[data-beat="1"] .beat-text'));
  for (const [width, height, folder] of [[852, 393, 'art'], [393, 852, 'portrait']] as const) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => scene.locator('.scene-image').evaluate((image: HTMLImageElement) =>
      image.naturalWidth > 0 && new URL(image.currentSrc).pathname)).toBe(deployPath + folder + '/17.webp');
    await expect(page.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', '17');
    expect(await scene.locator('.passage').textContent()).toBe(oracle.scenes[16].text);
    await expectNoOverflow(page);
  }
  await expect.poll(() => passageReadable(scene.locator('[data-beat="1"] .beat-text'))).toBe(true);
});

test('live motion preference stops particles and permits rereading in both directions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openBook(page);
  const canvas = page.locator('canvas[data-running]');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute('data-running', 'true');
  await expectReadable(await visitScene(page, 8));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(canvas).toHaveAttribute('data-running', 'false');
  for (const id of [9, 7, 20, 1]) await expectReadable(await visitScene(page, id));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(canvas).toHaveAttribute('data-running', 'true');
  await expectReadable(await visitScene(page, 4));
});

test('a reader with no 2D canvas can still reach and read the ending', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type === '2d') return null;
        return Reflect.apply(nativeGetContext, this, [type, ...args]);
      },
    });
  });
  await openBook(page);
  const last = await visitScene(page, 20);
  await expect(last.locator('.passage')).toHaveText(oracle.scenes[19].text);
  await expectReadable(last);
});
