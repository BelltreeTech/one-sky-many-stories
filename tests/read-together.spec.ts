import { expect } from '@playwright/test';
import { test, openBook, oracle, secondBeat, visitScene, passageReadable, readAt } from './reader-harness';

declare global {
  interface Window {
    __audioCalls?: string[];
  }
}

test('opening the story immediately supports silent, human-led reading at every reading position', async ({ page }, info) => {
  await page.addInitScript(() => {
    const calls: string[] = [];
    window.__audioCalls = calls;
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true, value: class { constructor(public text: string) {} },
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true, value: { getVoices: () => [], speak: () => calls.push('speak') },
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true, value: { getUserMedia: async () => { calls.push('microphone'); return new MediaStream(); } },
    });
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true, value: class { constructor() { calls.push('recorder'); } },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true, value(this: HTMLMediaElement) {
        if (!this.muted && this.volume > 0) calls.push('audible media');
        return Promise.resolve();
      },
    });
  });
  await openBook(page);
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '読み聞かせの操作' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const isPortrait = info.project.name !== 'desktop-chromium';
  let positions = 0;
  for (const source of oracle.scenes) {
    const scene = await visitScene(page, source.id);
    const texts = isPortrait ? scene.locator('.beat-text') : scene.locator('.passage');
    const count = isPortrait && secondBeat.has(source.id) ? 2 : 1;
    await expect(texts).toHaveCount(count);
    for (let beat = 0; beat < count; beat++) {
      await readAt(texts.nth(beat));
      expect(await passageReadable(texts.nth(beat))).toBe(true);
      positions++;
    }
  }
  expect(positions).toBe(isPortrait ? 23 : 20);
  expect(await page.evaluate(() => window.__audioCalls)).toEqual([]);
});

test('the human reader can linger at the questions in scenes seven and eleven', async ({ page }, info) => {
  if (info.project.name === 'desktop-chromium') await page.setViewportSize({ width: 393, height: 852 });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: undefined });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
  });
  await openBook(page);
  await page.clock.install();
  for (const id of [7, 11]) {
    const scene = await visitScene(page, id);
    const first = scene.locator('[data-beat="1"] .beat-text');
    const answer = scene.locator('[data-beat="2"] .beat-text');
    await readAt(first);
    const start = await page.evaluate(() => scrollY);
    await page.clock.fastForward(90_000);
    expect(await page.evaluate(() => scrollY)).toBe(start);
    expect(await passageReadable(first)).toBe(true);
    // Even the first line of the answer belongs to the reader's next swipe.
    const answerTop = await answer.evaluate(el => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return Math.min(...Array.from(range.getClientRects(), rect => rect.top)) - innerHeight;
    });
    expect(answerTop, 'No part of the answer is on screen at the question').toBeGreaterThanOrEqual(0);
    await readAt(answer);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(start);
    await readAt(first);
    expect(await page.evaluate(() => scrollY)).toBe(start);
  }

  if (info.project.name !== 'desktop-chromium') return;
  for (const [id, secondStarts] of secondBeat) {
    const scene = await visitScene(page, id);
    const original = oracle.scenes[id - 1].text;
    for (const crossIllustration of [false, true]) {
      await scene.evaluate((section, across) => {
        const parts = section.querySelectorAll('.beat-text');
        const first = parts[0].firstChild as Text;
        const end = (across ? parts[1] : parts[0]).firstChild as Text;
        // Leave one character outside either end of the cross-picture selection.
        getSelection()!.setBaseAndExtent(first, across ? 1 : 0, end, end.length - (across ? 1 : 0));
      }, crossIllustration);
      await page.keyboard.press('ControlOrMeta+c');
      const sink = await page.evaluateHandle(() => {
        const field = document.body.appendChild(document.createElement('textarea'));
        field.focus({ preventScroll: true });
        return field;
      });
      await page.keyboard.press('ControlOrMeta+v');
      const pasted = await sink.evaluate(field => { const value = field.value; field.remove(); return value; });
      await sink.dispose();
      const expected = crossIllustration ? original.slice(1, -1) : original.slice(0, original.indexOf(secondStarts)).trimEnd();
      expect(pasted.replace(/\r?\n/g, ' '), 'Pasted PDF text from scene ' + id).toBe(expected);
    }
  }
});
