import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { checkParity, parityErrors, type Strings } from './src/i18n/parity.ts';
import { precacheList, serviceWorkerSource } from './src/build/sw.ts';

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

// Writes sw.js next to the built files, listing them all for offline play (plan 2.2, D-94).
function offlineWorker(): Plugin {
  return {
    name: 'babsha-offline-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource(precacheList(Object.keys(bundle).sort())) });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [i18nParity(), offlineWorker()],
});
