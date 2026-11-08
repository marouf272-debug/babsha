// Bangla review sheet (D-95).
//   npm run review:export             writes docs/bangla-review.csv
//   npm run review:import -- <file>   applies a filled-in sheet to data/bn.json and data/bn-review.json
// See docs/bangla-review.md for the reviewer's instructions.

import { readFileSync, writeFileSync } from 'node:fs';
import { applyReview, parseCsv, reviewRows, toCsv, type Pending, type Strings } from '../src/build/review.ts';

const root = new URL('..', import.meta.url);
const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(p, root), 'utf8')) as T;
const write = (p: string, v: unknown) => writeFileSync(new URL(p, root), JSON.stringify(v, null, 2) + '\n');

const en = read<Strings>('data/en.json');
const bn = read<Strings>('data/bn.json');
const pending = read<Pending>('data/bn-review.json');
const [command, file] = process.argv.slice(2);

if (command === 'export') {
  const rows = reviewRows(en, bn, pending);
  writeFileSync(new URL('docs/bangla-review.csv', root), toCsv(rows));
  console.log(`Wrote docs/bangla-review.csv with ${rows.length} strings to review.`);
} else if (command === 'import' && file) {
  const r = applyReview(parseCsv(readFileSync(file, 'utf8')), en, bn, pending);
  if (r.errors.length) {
    console.error(`Nothing changed. Fix these rows first:\n${r.errors.join('\n')}`);
    process.exit(1);
  }
  write('data/bn.json', r.bn);
  write('data/bn-review.json', r.pending);
  console.log(`Approved ${r.summary.approved}, corrected ${r.summary.corrected}, still waiting ${r.summary.waiting}.`);
} else {
  console.error('Usage: npm run review:export, or npm run review:import -- <filled-in sheet.csv>');
  process.exit(1);
}
