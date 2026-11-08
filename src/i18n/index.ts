import en from '../../data/en.json';
import bn from '../../data/bn.json';

export type Lang = 'en' | 'bn';

const tables: Record<Lang, Record<string, string>> = { en, bn };
// Number locales: Bangla uses Bangla digits (FR-16); English uses Western digits.
const locales: Record<Lang, string> = { en: 'en-US', bn: 'bn-BD' };

let current: Lang = 'en';
const listeners = new Set<(lang: Lang) => void>();

export function setLang(lang: Lang): void {
  current = lang;
  for (const fn of listeners) fn(lang);
}

export function getLang(): Lang {
  return current;
}

export function onLangChange(fn: (lang: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function hasKey(key: string): boolean {
  return key in tables.en && key in tables.bn;
}

// Returns the string for a key. Placeholders like {amount} are replaced from params.
export function t(key: string, params: Record<string, string | number> = {}): string {
  const raw = tables[current][key];
  if (raw === undefined) throw new Error(`Missing i18n key: ${key}`);
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => (params[name] === undefined ? m : String(params[name])));
}

// A string in a given language, whatever the current one. Used for building signs, which are
// always Bangla (plan 3.7: Bangla script on all signage).
export function tIn(lang: Lang, key: string): string {
  const raw = tables[lang][key];
  if (raw === undefined) throw new Error(`Missing i18n key: ${key}`);
  return raw;
}

// Whole numbers in the current language's digits.
export function num(n: number): string {
  return new Intl.NumberFormat(locales[current], { maximumFractionDigits: 0 }).format(n);
}

// Taka amounts, e.g. ৳10,000 or ৳১০,০০০.
export function money(n: number): string {
  return `৳${num(n)}`;
}
