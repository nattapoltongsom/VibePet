import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

const STATIC_FILES = [
  'renderer/pet/index.html',
  'renderer/pet/styles.css',
  'renderer/setup/index.html',
  'renderer/setup/styles.css',
];

for (const rel of STATIC_FILES) {
  const src = path.join(appRoot, 'src', rel);
  const dst = path.join(appRoot, 'dist-js', rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

console.log(`Copied ${STATIC_FILES.length} static renderer assets to dist-js/`);
