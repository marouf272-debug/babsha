import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { checkParity, parityErrors, type Strings } from './src/i18n/parity.ts';

// Fails the build if a key exists in one language file and not the other (plan 3.3).
function i18nParity(): Plugin {
  return {
    name: 'babsha-i18n-parity',
    buildStart() {
      const read = (f: string): Strings => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), 'utf8'));
      const errors = parityErrors(checkParity(read('en.json'), read('bn.json')));
      if (errors.length > 0) this.error(`i18n parity check failed:\n${errors.join('\n')}`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [i18nParity()],
});
