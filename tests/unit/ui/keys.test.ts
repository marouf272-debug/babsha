import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import en from '../../../data/en.json';
import bn from '../../../data/bn.json';

const SRC = join(import.meta.dirname, '..', '..', '..', 'src');
const files = (dir: string, out: string[] = []): string[] => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) files(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
};

describe('language keys used by the code (FR-15, CLAUDE.md)', () => {
  it('every fixed key passed to t() exists in both language files', () => {
    const used = new Set<string>();
    for (const f of files(SRC)) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) used.add(m[1]!);
    expect(used.size).toBeGreaterThan(50);
    const missing = [...used].filter((k) => !(k in en) || !(k in bn));
    expect(missing).toEqual([]);
  });
});
