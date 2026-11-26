import type { Locator, Page } from '@playwright/test';

// Compare the actual foreground to the composited pixels under each text
// fragment, including any photographic detail and the scene's gradient.
// The background sample covers the whole rendered line box, including spaces.
export async function measureReadingContrast(page: Page, text: Locator) {
  const lines = await text.evaluate(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const fragments = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim() || !node.parentElement) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const color = getComputedStyle(node.parentElement).color;
      let opacity = 1;
      for (let ancestor: Element | null = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
        opacity *= Number(getComputedStyle(ancestor).opacity);
      }
      for (const rect of range.getClientRects()) {
        if (rect.width && rect.height) {
          fragments.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, color, opacity });
        }
      }
    }
    return fragments;
  });
  if (!lines.length) throw Error('Contrast requires visible text fragments');

  const mask = await page.addStyleTag({ content: `
    .passage, .passage .beat-text {
      color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important;
    }` });
  let background: Buffer;
  try {
    background = await page.screenshot({ scale: 'css' });
  } finally {
    await mask.evaluate(element => element.parentNode?.removeChild(element));
  }
  return page.evaluate(async ({ png, lines }) => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + png;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const bitmap = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const lin = (v: number) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (r: number, g: number, b: number) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
    let minimum = Infinity;
    let sampled = 0;
    for (const line of lines) {
      // Canvas resolves computed CSS colors including modern color syntax.
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = line.color;
      context.fillRect(0, 0, 1, 1);
      const color = context.getImageData(0, 0, 1, 1).data;
      const alpha = line.opacity * color[3] / 255;
      for (let y = Math.max(0, Math.ceil(line.y)); y < Math.min(canvas.height, Math.floor(line.y + line.height)); y++) {
        for (let x = Math.max(0, Math.ceil(line.x)); x < Math.min(canvas.width, Math.floor(line.x + line.width)); x++) {
          const i = (y * canvas.width + x) * 4;
          const r = bitmap[i], g = bitmap[i + 1], b = bitmap[i + 2];
          const bg = luminance(r, g, b);
          const fg = luminance(alpha * color[0] + (1 - alpha) * r, alpha * color[1] + (1 - alpha) * g, alpha * color[2] + (1 - alpha) * b);
          minimum = Math.min(minimum, (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05));
          sampled++;
        }
      }
    }
    if (!sampled) throw Error('Contrast sampling area is outside the viewport');
    return { minimum, sampled, lines: lines.length };
  }, { png: background.toString('base64'), lines });
}
