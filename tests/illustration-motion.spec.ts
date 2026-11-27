import { expect, type Locator } from '@playwright/test';
import { test, openBook, oracle } from './reader-harness';

const stillFrames = (el: Locator) => el.evaluate(() => new Promise<void>(resolve =>
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

test('each portrait has its own reversible detail registered to the painted scene', async ({ page }) => {
  await openBook(page);
  const signatures = new Set<string>();
  for (const { id, text } of oracle.scenes) {
    const scene = page.locator('[data-scene="' + id + '"]');
    const art = scene.locator('.portrait-stage');
    await art.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const overlay = scene.locator('[data-illustration-motion]');
    await expect(overlay).toHaveAttribute('data-illustration-motion', String(id));
    await expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(await scene.locator('.passage').textContent()).toBe(text);
    if (id === 12) {
      await expect(overlay.locator('.leo-book img')).toHaveAttribute('data-decoded', 'true');
      signatures.add('leo-book');
      continue;
    }
    const details = overlay.locator('[data-painted-detail]');
    const names = await details.evaluateAll(nodes => nodes.map(n => n.getAttribute('data-painted-detail')).join('/'));
    expect(names).toBeTruthy();
    signatures.add(names);
    // Stay within the real scroll range of the cover and ending as well.
    const [first, second] = await art.evaluate(el => {
      const y = scrollY + el.getBoundingClientRect().top;
      const maximum = document.documentElement.scrollHeight - innerHeight;
      const middle = y + (el.clientHeight - innerHeight) / 2;
      const first = Math.max(0, Math.min(maximum - 100, Math.round(middle) - 50));
      return [first, first + 100];
    });
    const sample = async (y: number) => {
      await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), y);
      await stillFrames(art);
      return details.locator(':scope > i').evaluateAll(elements => elements.map(node => {
        const style = (node as HTMLElement).style;
        return style.transform + '|' + style.opacity;
      }).join('/'));
    };
    const before = await sample(first);
    expect(await sample(second), 'Moving through scene ' + id + ' changes its illustration').not.toBe(before);
    expect(await sample(first), 'Reverse scroll restores the same ink and light in scene ' + id).toBe(before);
    expect(await page.locator('[data-illustration-motion]').count()).toBeLessThanOrEqual(4);
  }
  expect(signatures.size).toBe(20);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-illustration-motion]')).toHaveCount(0);
  await expect(page.locator('#scene-20 .passage')).toHaveText(oracle.scenes[19].text);
});
