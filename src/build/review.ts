// The Bangla review sheet (plan 5, D-95): export every string still marked "needs native review"
// to a spreadsheet the reviewer can fill in, then apply their answers to data/bn.json and
// data/bn-review.json. Pure functions; scripts/bangla-review.ts does the file reading and writing.

export type Strings = Record<string, string>;
// keys: strings still waiting for a native reader. approved: the Bangla text a reader approved, per
// key, so a string that changes after approval shows up as unreviewed again (D-99).
export interface Pending { status: string; keys: Record<string, string>; approved?: Record<string, string> }
export interface ReviewRow { key: string; english: string; bangla: string; ok: string; correction: string; note: string }

const COLUMNS: Array<keyof ReviewRow> = ['key', 'english', 'bangla', 'ok', 'correction', 'note'];
const EM_DASH = String.fromCharCode(0x2014);
const BOM = String.fromCharCode(0xfeff);

export function reviewRows(en: Strings, bn: Strings, pending: Pending): ReviewRow[] {
  return Object.keys(pending.keys).sort().map((key) => ({ key, english: en[key] ?? '', bangla: bn[key] ?? '', ok: '', correction: '', note: '' }));
}

const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

// UTF-8 with a byte order mark, so Excel and Numbers open the Bangla correctly.
export function toCsv(rows: ReviewRow[]): string {
  return BOM + [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}

export function parseCsv(text: string): ReviewRow[] {
  const src = text.replace(new RegExp(`^${BOM}`), '');
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) records.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((f) => f !== '')) records.push(row); }
  const [head, ...body] = records;
  const index = COLUMNS.map((c) => head?.indexOf(c) ?? -1);
  return body.map((r) => Object.fromEntries(COLUMNS.map((c, i) => [c, index[i]! >= 0 ? (r[index[i]!] ?? '').trim() : ''])) as unknown as ReviewRow);
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(' ');
const yes = (v: string) => /^(y|yes|ok|x|হ্যাঁ|ঠিক)$/i.test(v.trim());

export function applyReview(rows: ReviewRow[], en: Strings, bn: Strings, pending: Pending) {
  const errors: string[] = [];
  const nextBn = { ...bn };
  const nextKeys = { ...pending.keys };
  const nextApproved = { ...pending.approved };
  let approved = 0;
  let corrected = 0;
  for (const r of rows) {
    if (!yes(r.ok) && !r.correction) continue;
    if (!(r.key in en)) { errors.push(`${r.key}: not a string in the game`); continue; }
    if (r.correction) {
      if (r.correction.includes(EM_DASH)) { errors.push(`${r.key}: em dash in the correction`); continue; }
      if (placeholders(r.correction) !== placeholders(en[r.key]!)) { errors.push(`${r.key}: the correction must keep ${placeholders(en[r.key]!) || 'no placeholders'}`); continue; }
      nextBn[r.key] = r.correction;
      corrected++;
    } else approved++;
    delete nextKeys[r.key];
    nextApproved[r.key] = nextBn[r.key]!;
  }
  // All or nothing: one bad row leaves both files as they were.
  if (errors.length) return { errors, bn, pending, summary: { approved: 0, corrected: 0, waiting: Object.keys(pending.keys).length } };
  return { errors, bn: nextBn, pending: { ...pending, keys: nextKeys, approved: nextApproved }, summary: { approved, corrected, waiting: Object.keys(nextKeys).length } };
}
