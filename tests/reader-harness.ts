import { expect, test as base, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface PDFPage {
  id: number;
  text: string;
  width: number;
  height: number;
}

export const screenshots = path.resolve(process.env.PLAYWRIGHT_PUBLIC_URL ? 'artifacts/public-portrait-qa/screenshots' : 'artifacts/screenshots');
export const deployPath = process.env.PLAYWRIGHT_PUBLIC_URL ? new URL(process.env.PLAYWRIGHT_PUBLIC_URL).pathname : process.env.VITE_BASE_PATH || '/one-sky-many-stories/';
// Independent landmarks from the PDF. A word appearing on either side of a
// boundary changes what the reader sees before making the discovery.
export const secondBeat = new Map([
  [7, 'Luna counted them slowly.'],
  [8, '“Some are hard to see'],
  [11, '“In one version of the story'],
]);
export const oracle: { title: string; scenes: PDFPage[] } = JSON.parse(readFileSync('tests/fixtures/pdf-oracle.json', 'utf8'));
const expectedImageErrors = new WeakMap<Page, Set<string>>();

export function expectImageFailures(page: Page, urls: string[]) {
  expectedImageErrors.set(page, new Set(urls));
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    await mkdir(screenshots, { recursive: true });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', entry => {
      if (entry.type() === 'error' && !expectedImageErrors.get(page)?.has(entry.location().url)) {
        errors.push(entry.text());
      }
    });
    page.on('response', response => {
      if (response.status() >= 400 && !expectedImageErrors.get(page)?.has(response.url())) {
        errors.push(response.status() + ' ' + response.url());
      }
    });
    await use(page);
    expect(errors, 'Browser exceptions, console errors, or broken resources').toEqual([]);
  },
});

export async function openBook(page: Page) {
  await page.goto('./');
  await expect(page).toHaveURL(url => url.pathname === deployPath);
  await expect(page).toHaveTitle(/One Sky, Many Stories/i);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page.locator('[data-scene]')).toHaveCount(20);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute('content', /user-scalable=no/);
  await page.evaluate(async () => { await document.fonts.ready; });
}

export function sceneAt(page: Page, id: number) {
  return page.locator('[data-scene="' + id + '"]');
}

export async function visitScene(page: Page, id: number) {
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
export async function passageReadable(passage: Locator) {
  return passage.evaluate(element => {
    const nodes = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const controls = [...document.querySelectorAll('.reading-dock button, .reading-dock .manual-reading, .masthead .edition-mark, .masthead .folio')]
      .map(control => control.getBoundingClientRect()).filter(rect => rect.width && rect.height);
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
        if (boxes.some(rect => controls.some(control => rect.right > control.left && rect.left < control.right
          && rect.bottom > control.top && rect.top < control.bottom))) return false;
      }
      node = nodes.nextNode();
    }
    return words > 0;
  });
}

export async function expectReadable(scene: Locator) {
  const openingBeat = scene.locator('[data-beat="1"] .beat-text');
  await readAt(await openingBeat.count() ? openingBeat : scene.locator('.passage'));
}

export async function readAt(text: Locator) {
  await text.evaluate(element => {
    const beat = element.closest('[data-beat]');
    if (beat) beat.scrollIntoView({ block: 'start', behavior: 'instant' });
    else element.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await text.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect.poll(() => passageReadable(text), 'Every text fragment fits in the visible reading area').toBe(true);
}

export async function captureFrame(page: Page, filename: string) {
  await page.screenshot({ path: path.join(screenshots, filename + '.png'), scale: 'css' });
}

export async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}
