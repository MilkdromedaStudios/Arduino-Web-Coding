import {existsSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const DEV_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = path.join(DEV_ROOT, 'turbowarp-gui');
const UPSTREAM = 'https://github.com/TurboWarp/scratch-gui.git';
const COMMIT = '25c11c6f246de9c6d36b29a61c505cd35f34cb8c';

const run = (cmd, args, cwd = DEV_ROOT) => {
    const result = spawnSync(cmd, args, {cwd, stdio: 'inherit', shell: process.platform === 'win32'});
    if (result.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
};

const capture = (cmd, args, cwd = DEV_ROOT) => {
    const result = spawnSync(cmd, args, {cwd, encoding: 'utf8', shell: process.platform === 'win32'});
    if (result.status !== 0) return '';
    return result.stdout.trim();
};

if (existsSync(path.join(DEST, '.git'))) {
    const current = capture('git', ['rev-parse', 'HEAD'], DEST);
    if (current === COMMIT) {
        console.log(`TurboWarp already pinned at ${COMMIT}. Resetting local modifications before patching.`);
        run('git', ['reset', '--hard', COMMIT], DEST);
        run('git', ['clean', '-fd'], DEST);
        process.exit(0);
    }
}

rmSync(DEST, {recursive: true, force: true});
console.log(`Cloning TurboWarp scratch-gui at ${COMMIT} into ${DEST}`);
run('git', ['clone', '--no-tags', '--filter=blob:none', UPSTREAM, DEST]);
run('git', ['checkout', '--detach', COMMIT], DEST);
console.log('TurboWarp source synchronized.');
