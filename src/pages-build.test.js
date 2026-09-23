import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('GitHub Pages build configuration', () => {
  it('uses relative asset paths for repository subpath hosting', () => {
    const config = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
    expect(config).toContain("base: './'");
  });
});
