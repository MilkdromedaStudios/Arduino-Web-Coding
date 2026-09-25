import {cpSync, existsSync, readdirSync, rmSync, copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const DEV_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(DEV_ROOT, 'turbowarp-gui', 'build');

if (!existsSync(BUILD)) throw new Error('TurboWarp build output not found.');

// Only remove known generated web assets. Keep the source/setup files in /dev.
for (const name of ['static', 'js', 'media', 'chunks', 'assets']) {
    rmSync(path.join(DEV_ROOT, name), {recursive: true, force: true});
}

for (const entry of readdirSync(BUILD)) {
    cpSync(path.join(BUILD, entry), path.join(DEV_ROOT, entry), {recursive: true, force: true});
}

// TurboWarp produces editor.html. Make /dev/ open that editor directly.
const editor = path.join(DEV_ROOT, 'editor.html');
if (existsSync(editor)) copyFileSync(editor, path.join(DEV_ROOT, 'index.html'));

console.log('Published customized TurboWarp build to /dev/.');
