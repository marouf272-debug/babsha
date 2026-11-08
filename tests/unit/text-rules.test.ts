import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const SKIP = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report']);
const EXT = /\.(ts|js|json|md|html|css)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.test(name) && name !== 'package-lock.json') out.push(p);
  }
  return out;
}

describe('project text rules (CLAUDE.md)', () => {
  it('no em dashes in any project text file', () => {
    const emDash = String.fromCharCode(0x2014);
    const offenders = walk(ROOT).filter((f) => readFileSync(f, 'utf8').includes(emDash)).map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
