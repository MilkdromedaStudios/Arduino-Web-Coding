import {defineConfig} from 'vite';
import {nodePolyfills} from 'vite-plugin-node-polyfills';

// Relative URLs keep GitHub Pages subpaths and custom domains working. The
// uploader's STK500 library uses Node stream primitives, so browser shims are
// bundled instead of requiring any locally installed software.
export default defineConfig({
  base: './',
  plugins: [nodePolyfills({include:['buffer','process','stream']})],
  test: {include: ['src/**/*.test.js']}
});
