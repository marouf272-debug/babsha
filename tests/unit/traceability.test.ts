import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Plan 5: every FR in section 2.1 maps to at least one test. Requirements join this list as
// their sprint lands; the full list is required at gate G5.
const REQUIRED_SO_FAR = ['FR-01', 'FR-02', 'FR-03', 'FR-04', 'FR-05', 'FR-06', 'FR-07', 'FR-08', 'FR-09', 'FR-10', 'FR-11', 'FR-13'];

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
  it('every requirement delivered so far is named by at least one test', () => {
    const text = [...testFiles(join(ROOT, 'tests')), ...testFiles(join(ROOT, 'sim'))].map((f) => readFileSync(f, 'utf8')).join('\n');
    const missing = REQUIRED_SO_FAR.filter((id) => !new RegExp(`it\\([^)]*${id}`).test(text));
    expect(missing).toEqual([]);
  });
});
