import { afterEach, describe, expect, it } from 'vitest';
import { money, num, setLang } from '../../../src/i18n';

describe('Taka formatting (FR-16)', () => {
  afterEach(() => setLang('en'));
  it('FR-16: amounts show the Taka sign with thousands separators in English', () => {
    setLang('en');
    expect(money(10000)).toBe('৳10,000');
  });
  it('FR-16: in Bangla, amounts and numbers use Bangla digits', () => {
    setLang('bn');
    expect(money(10000)).toBe('৳১০,০০০');
    expect(num(6)).toBe('৬');
  });
});
