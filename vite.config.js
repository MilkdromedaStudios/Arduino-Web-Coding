import {defineConfig} from 'vite';

// GitHub Pages serves project sites from /<repository>/ rather than the domain
// root. Relative asset URLs keep the same build working at that subpath, at a
// custom domain, and when dist/index.html is previewed from any static server.
export default defineConfig({
  base: './'
});
