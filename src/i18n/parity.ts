// Language file parity check (plan 3.3). Pure function so it runs in tests and in the build.

export type Strings = Record<string, string>;

export interface ParityResult {
  missingInBn: string[];
  missingInEn: string[];
  emptyKeys: string[];
}

export function checkParity(en: Strings, bn: Strings): ParityResult {
  const enKeys = new Set(Object.keys(en));
  const bnKeys = new Set(Object.keys(bn));
  const missingInBn = [...enKeys].filter((k) => !bnKeys.has(k)).sort();
  const missingInEn = [...bnKeys].filter((k) => !enKeys.has(k)).sort();
  const allKeys = new Set([...enKeys, ...bnKeys]);
  const isEmpty = (v: string | undefined) => v !== undefined && v.trim() === '';
  const emptyKeys = [...allKeys].filter((k) => isEmpty(en[k]) || isEmpty(bn[k])).sort();
  return { missingInBn, missingInEn, emptyKeys };
}

export function parityErrors(result: ParityResult): string[] {
  const errors: string[] = [];
  for (const k of result.missingInBn) errors.push(`Key "${k}" is in en.json but not in bn.json`);
  for (const k of result.missingInEn) errors.push(`Key "${k}" is in bn.json but not in en.json`);
  for (const k of result.emptyKeys) errors.push(`Key "${k}" has an empty string`);
  return errors;
}
