import type { Page } from '@playwright/test';

// Count differences in the final composited browser images, excluding small
// color variations below the chosen per-channel threshold.
export function changedPixels(page: Page, lit: Buffer, unlit: Buffer, threshold: number) {
  return page.evaluate(async ({ images, threshold }) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    for (const [index, png] of images.entries()) {
      const image = new Image();
      image.src = 'data:image/png;base64,' + png;
      await image.decode();
      if (index === 0) { canvas.width = image.width; canvas.height = image.height; }
      else ctx.globalCompositeOperation = 'difference';
      ctx.drawImage(image, 0, 0);
    }
    const differences = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let visible = 0;
    for (let i = 0; i < differences.length; i += 4) {
      if (Math.max(differences[i], differences[i + 1], differences[i + 2]) > threshold) visible++;
    }
    return visible;
  }, { images: [lit.toString('base64'), unlit.toString('base64')], threshold });
}
