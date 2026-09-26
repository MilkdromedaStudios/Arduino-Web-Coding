import {copyFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const DEV_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(DEV_ROOT, 'overrides/python-sync.js');
const destination = path.join(DEV_ROOT, 'turbowarp-gui/src/components/python-editor/python-sync.js');

if (!existsSync(source)) throw new Error('Missing dev/overrides/python-sync.js');
if (!existsSync(path.dirname(destination))) throw new Error('Python editor patch has not been installed yet. Run the patch step first.');

copyFileSync(source, destination);
console.log('Installed live Blocks/Python sync module.');
