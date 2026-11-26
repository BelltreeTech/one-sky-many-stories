import { expect } from '@playwright/test';
import { test, openBook, oracle, secondBeat, sceneAt, visitScene, passageReadable, readAt } from './reader-harness';

declare global {
  interface Window {
    __voiceCommands?: string[];
    __failVoice?: () => void;
  }
}

test('Japanese read-along controls turn every readable page without a speech engine', async ({ page }, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: undefined });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
  });
  await openBook(page);
  const dock = page.getByRole('navigation', { name: '読み聞かせの操作' });
  await dock.getByRole('button', { name: '読み聞かせを始める' }).click();
  const back = dock.getByRole('button', { name: '前へ' });
  const next = dock.getByRole('button', { name: '次へ' });
  await expect(back).toBeDisabled();
  await expect(dock.getByText('声に出して読む')).toBeVisible();
  const isPortrait = info.project.name !== 'desktop-chromium';
  for (const source of oracle.scenes) {
    const scene = sceneAt(page, source.id);
    await expect(page.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', String(source.id));
    const split = isPortrait && secondBeat.has(source.id);
    const first = scene.locator(split ? '[data-beat="1"] .beat-text' : '.passage');
    await expect.poll(() => passageReadable(first), 'The button lands on readable English at scene ' + source.id).toBe(true);
    if (split) {
      const answer = scene.locator('[data-beat="2"] .beat-text');
      await next.click();
      await expect.poll(() => passageReadable(answer)).toBe(true);
      await back.click();
      await expect.poll(() => passageReadable(first)).toBe(true);
      await next.click();
      await expect.poll(() => passageReadable(answer)).toBe(true);
    }
    if (source.id < oracle.scenes.length) await next.click();
  }
  await dock.getByRole('button', { name: '最初へ' }).click();
  await expect(page.locator('[data-current-scene]')).toHaveAttribute('data-current-scene', '1');
  await expect(back).toBeDisabled();
  await expect.poll(() => passageReadable(sceneAt(page, 1).locator('.passage'))).toBe(true);
});

test('spoken English pauses, resumes, and stops before the next reading position', async ({ page }, info) => {
  // The browser engine may have no installed English voice on CI. Record its
  // Web Speech commands and exact utterance separately from human audio QA.
  await page.addInitScript(() => {
    const commands: string[] = [];
    const speech = {
      paused: false,
      getVoices: () => [],
      speak: (utterance: SpeechSynthesisUtterance) => {
        commands.push('speak ' + utterance.text);
        window.__failVoice = () => {
          utterance.onerror?.call(utterance, new Event('error') as SpeechSynthesisErrorEvent);
        };
      },
      pause() { this.paused = true; commands.push('pause'); },
      resume() { this.paused = false; commands.push('resume'); },
      cancel() { this.paused = false; commands.push('cancel'); },
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true, value: class { constructor(public text: string) {} },
    });
    Object.defineProperty(window, '__voiceCommands', { value: commands });
  });
  const commands = () => page.evaluate(() => window.__voiceCommands!);
  await openBook(page);
  const dock = page.getByRole('navigation', { name: '読み聞かせの操作' });
  await dock.getByRole('button', { name: '読み聞かせを始める' }).click();
  await dock.getByRole('button', { name: '英語で聴く' }).click();
  await dock.getByRole('button', { name: '一時停止' }).click();
  await dock.getByRole('button', { name: '音声を再開' }).click();
  await dock.getByRole('button', { name: '次へ' }).click();
  await expect.poll(commands).toEqual(['speak ' + oracle.scenes[0].text, 'pause', 'resume', 'cancel']);
  await expect(dock.getByRole('button', { name: '英語で聴く' })).toBeVisible();
  if (info.project.name !== 'desktop-chromium') {
    const scene = await visitScene(page, 11);
    const first = scene.locator('[data-beat="1"] .beat-text');
    const answer = scene.locator('[data-beat="2"] .beat-text');
    await readAt(first);
    await dock.getByRole('button', { name: '英語で聴く' }).click();
    const question = oracle.scenes[10].text.split(secondBeat.get(11)!)[0].trimEnd();
    await expect.poll(async () => (await commands()).at(-1)).toBe('speak ' + question);
    await readAt(answer);
    await expect.poll(async () => (await commands()).at(-1)).toBe('cancel');
  }
  await dock.getByRole('button', { name: '英語で聴く' }).click();
  await page.evaluate(() => window.__failVoice!());
  await expect(dock.getByRole('status')).toContainText('再生できませんでした');
  await expect(dock.getByRole('button', { name: '次へ' })).toBeEnabled();
});
