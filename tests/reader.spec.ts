import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

interface PDFPage {
  id: number;
  text: string;
  width: number;
  height: number;
}

const screenshots = path.resolve('artifacts/screenshots');
const deployPath = process.env.VITE_BASE_PATH || '/one-sky-many-stories/';
const faults = new WeakMap<Page, string[]>();
let oracle: { title: string; scenes: PDFPage[] };

test.beforeAll(async () => {
  oracle = JSON.parse(await readFile('tests/fixtures/pdf-oracle.json', 'utf8'));
  await mkdir(screenshots, { recursive: true });
});

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  faults.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', entry => {
    if (entry.type() === 'error') errors.push(entry.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(response.status() + ' ' + response.url());
  });
});

test.afterEach(({ page }) => {
  expect(faults.get(page), 'Browser exceptions, console errors, or broken resources').toEqual([]);
});

async function openBook(page: Page) {
  await page.goto('./');
  await expect(page).toHaveURL(url => url.pathname === deployPath);
  await expect(page).toHaveTitle(/One Sky, Many Stories/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.locator('[data-scene]')).toHaveCount(20);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute('content', /user-scalable=no/);
  await page.evaluate(async () => { await document.fonts.ready; });
}

function sceneAt(page: Page, id: number) {
  return page.locator('[data-scene="' + id + '"]');
}

async function visitScene(page: Page, id: number) {
  const scene = sceneAt(page, id);
  await scene.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const delta = rect.top + (rect.height - window.innerHeight) / 2;
    window.scrollBy({ top: delta, behavior: 'instant' });
  });
  await expect(page.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', String(id));
  return scene;
}

// Measure the rendered text fragments themselves, including opacity inherited
// from any animated wrappers. A present but transparent DOM node is unreadable.
async function passageReadable(passage: Locator) {
  return passage.evaluate(element => {
    const nodes = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = nodes.nextNode();
    let words = 0;
    while (node) {
      if (node.textContent?.trim()) {
        words++;
        let opacity = 1;
        for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          opacity *= Number(style.opacity);
          if (style.visibility !== 'visible' || style.display === 'none') return false;
        }
        if (opacity < 0.85) return false;
        const range = document.createRange();
        range.selectNodeContents(node);
        const boxes = [...range.getClientRects()].filter(rect => rect.width && rect.height);
        if (!boxes.length || boxes.some(rect => rect.left < -1 || rect.right > innerWidth + 1
          || rect.top < -1 || rect.bottom > innerHeight + 1)) return false;
      }
      node = nodes.nextNode();
    }
    return words > 0;
  });
}

async function expectReadable(scene: Locator) {
  await expect.poll(() => passageReadable(scene.locator('.passage'))).toBe(true);
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test('twenty illustrations and passages match the PDF in the production reader', async ({ page }, info) => {
  const isPhone = info.project.name === 'iphone-webkit';
  const resources = new Map<string, string>();
  page.on('response', response => resources.set(response.url(), response.headers()['content-type'] ?? ''));
  await openBook(page);
  const story = JSON.parse(await readFile('src/data/story.json', 'utf8'));
  expect(story.title).toBe(oracle.title);
  expect(story.scenes.map(({ id, text, width, height }: PDFPage) => ({ id, text, width, height }))).toEqual(oracle.scenes);
  expect(oracle.scenes.map(scene => scene.id)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(oracle.title, { ignoreCase: true });

  // Late scenes should not already have fetched every original at initial load.
  expect([...resources.keys()].filter(url => /\/art\/\d+\.webp$/.test(url)).length).toBeLessThan(20);
  for (const source of oracle.scenes) {
    await test.step('Read PDF page ' + source.id, async () => {
      const scene = await visitScene(page, source.id);
      await expect(scene.locator('.passage')).toHaveText(source.text);
      await expectReadable(scene);
      const mainImage = scene.locator('img.scene-image');
      await expect(mainImage).toHaveAttribute('src', /\.webp$/);
      const asset = await mainImage.evaluate(async (element: HTMLImageElement) => {
        await element.decode();
        return { width: element.naturalWidth, height: element.naturalHeight, url: element.currentSrc, alt: element.alt };
      });
      expect([asset.width, asset.height]).toEqual([source.width, source.height]);
      expect(asset.alt.trim()).not.toBe('');
      expect(new URL(asset.url).pathname).toBe(deployPath + story.scenes[source.id - 1].image);
      expect(resources.get(asset.url)).toMatch(/^image\/webp\b/);
      await expectNoOverflow(page);
      if (isPhone || source.id === 1) {
        const name = isPhone ? 'iphone-' + String(source.id).padStart(2, '0') : 'desktop-opening';
        await page.screenshot({ path: path.join(screenshots, name + '.png'), scale: 'css' });
      }
    });
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
  for (const [url, contentType] of fetched) {
    if (new URL(url).pathname.endsWith('.woff2')) expect(contentType).toMatch(/font|woff|octet-stream/i);
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
