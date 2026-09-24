import {describe,expect,it} from 'vitest';
import {toolbox} from './blocks.js';

describe('Arduino toolbox navigation',()=>{
  it('gives every category a unique id so Scratch Blocks can scroll to it',()=>{
    const ids=[...toolbox.matchAll(/<category id="([^"]+)"/g)].map(match=>match[1]);
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['events','control','pins','operators','variables','serial','hardware']);
  });
});
