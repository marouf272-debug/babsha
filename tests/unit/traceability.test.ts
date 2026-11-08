import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Plan 5: every FR in section 2.1 maps to at least one test; a missing mapping blocks gate G5.
// FR-18 is dropped and FR-20 is Won't for release 1 (R-62), so they have nothing to test.
const NOT_IN_RELEASE_1 = ['FR-18', 'FR-20'];
const ALL = Array.from({ length: 20 }, (_, i) => `FR-${String(i + 1).padStart(2, '0')}`);
const REQUIRED = ALL.filter((id) => !NOT_IN_RELEASE_1.includes(id));

const ROOT = join(import.meta.dirname, '..', '..');
function testFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) testFiles(p, out);
    else if (/\.(test|spec)\.ts$/.test(name) && name !== 'traceability.test.ts') out.push(p);
  }
  return out;
}

describe('requirement traceability (plan 5)', () => {
  it('every release 1 requirement is named by at least one test (gate G5)', () => {
    const text = [...testFiles(join(ROOT, 'tests')), ...testFiles(join(ROOT, 'sim'))].map((f) => readFileSync(f, 'utf8')).join('\n');
    const missing = REQUIRED.filter((id) => !new RegExp(`\\b(it|test)\\([^)]*${id}`).test(text));
    expect(missing).toEqual([]);
  });
});
