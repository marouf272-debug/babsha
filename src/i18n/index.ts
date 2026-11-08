import en from '../../data/en.json';
import bn from '../../data/bn.json';

export type Lang = 'en' | 'bn';

const tables: Record<Lang, Record<string, string>> = { en, bn };

let current: Lang = 'en';

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

// Returns the string for a key. Placeholders like {amount} are replaced from params.
export function t(key: string, params: Record<string, string> = {}): string {
  const raw = tables[current][key];
  if (raw === undefined) throw new Error(`Missing i18n key: ${key}`);
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => params[name] ?? m);
}
