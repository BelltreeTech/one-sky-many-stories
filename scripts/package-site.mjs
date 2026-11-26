import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
const dependencies = join(root, 'node_modules');
const story = JSON.parse(readFileSync(join(root, 'src/data/story.json'), 'utf8'));

if (!existsSync(join(dist, 'index.html'))) {
  throw new Error('Run the Vite production build before packaging.');
}

const required = new Set(['index.html', 'star.svg', 'atmosphere/night-sky.webp', 'portrait/telescope.webp', 'portrait/ridge.webp', 'portrait/before-memory.webp']);
for (const scene of story.scenes) {
  const filename = String(scene.id).padStart(2, '0') + '.webp';
  required.add(scene.image);
  required.add('atmosphere/' + filename);
  required.add('portrait/' + filename);
  required.add('portrait/preview/' + filename);
  if (scene.portrait) required.add(scene.portrait.image);
}

// Ship the notices from the installed, lockfile-pinned packages with the runtime.
const licenseDir = join(dist, 'licenses');
mkdirSync(licenseDir, { recursive: true });
const licenseFiles = new Map([
  ['@fontsource-variable/cormorant-garamond', 'Cormorant-Garamond-OFL.txt'],
  ['@fontsource-variable/cinzel', 'Cinzel-OFL.txt'],
  ['@fontsource-variable/lora', 'Lora-OFL.txt'],
  ['react', 'react-MIT.txt'],
  ['react-dom', 'react-dom-MIT.txt'],
  ['scheduler', 'scheduler-MIT.txt'],
]);
for (const [packageName, filename] of licenseFiles) {
  copyFileSync(join(dependencies, packageName, 'LICENSE'), join(licenseDir, filename));
  required.add(`licenses/${filename}`);
}

// GSAP publishes its standard license URL and copyright in its npm README.
const gsapReadme = readFileSync(join(dependencies, 'gsap/README.md'), 'utf8');
const section = gsapReadme.match(/^### License\s*\n([\s\S]+)$/m)?.[1];
if (!section?.includes('https://gsap.com/standard-license') || !section.includes('Copyright')) {
  throw new Error('Review the GSAP package license before distributing this version.');
}
const gsapNotice = section.replace(/<a href="([^"]+)">[^<]*<\/a>/g, '$1').trim();
writeFileSync(join(licenseDir, 'GSAP.txt'), gsapNotice + '\n');
required.add('licenses/GSAP.txt');

// A Pages upload contains only the reading experience and its notices.
const bundledAsset = /^assets\/[\w.-]+\.(?:js|css|woff2|js\.LICENSE\.txt)$/;
const assets = [];
let total = 0;
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    const path = relative(dist, absolute).split('\\').join('/');
    if (entry.isDirectory()) {
      inspect(absolute);
      continue;
    }
    if (!entry.isFile() || (!required.has(path) && !bundledAsset.test(path))) {
      throw new Error(`Unexpected file in the Pages artifact: ${path}`);
    }
    if (bundledAsset.test(path)) assets.push(path);
    required.delete(path);
    total += 1;
  }
}
inspect(dist);
if (required.size) {
  throw new Error(`Missing Pages assets: ${[...required].join(', ')}`);
}
for (const extension of ['.js', '.css']) {
  if (!assets.some(path => path.endsWith(extension))) {
    throw new Error(`Missing bundled ${extension} entry for the reader.`);
  }
}
for (const font of ['cormorant-garamond', 'cinzel', 'lora']) {
  if (!assets.some(path => path.startsWith(`assets/${font}-`) && path.endsWith('.woff2'))) {
    throw new Error(`Missing self-hosted ${font} font.`);
  }
}
console.log(`Verified ${total} files for GitHub Pages, including ${story.scenes.length} illustrations and runtime licenses.`);
