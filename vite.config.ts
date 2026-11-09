import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { checkParity, parityErrors, type Strings } from './src/i18n/parity.ts';
import { precacheList, serviceWorkerSource } from './src/build/sw.ts';
import { ICONS, headTags, webManifest } from './src/build/manifest.ts';

const readJson = <T>(f: string): T => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8')) as T;
const version = readJson<{ version: string }>('./package.json').version;

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

// Release files (plan phase 6, D-102, D-103): the web app manifest and the icons drawn by
// scripts/make-icons.ts, so the game installs to the home screen; version.json, so a deploy or a
// rollback can be checked from outside; and sw.js, listing every built file for offline play
// (plan 2.2, D-94).
function releaseFiles(): Plugin {
  const app = readJson<{ install: { themeColor: string; backgroundColor: string; orientation: string } }>('./data/app.json').install;
  return {
    name: 'babsha-release-files',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: () => headTags(app.themeColor).map((t) => ({ ...t, injectTo: 'head' as const })),
    generateBundle(_options, bundle) {
      const name = readJson<Record<string, string>>('./data/en.json')['app.title']!;
      const extra: string[] = [];
      const emit = (fileName: string, source: string | Uint8Array) => { this.emitFile({ type: 'asset', fileName, source }); extra.push(fileName); };
      for (const icon of ICONS) emit(icon.file, readFileSync(new URL(`./assets/${icon.file}`, import.meta.url)));
      emit('manifest.webmanifest', JSON.stringify(webManifest({ name, lang: 'en', ...app }), null, 2));
      // Not precached, so it always reports what the host is serving now.
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) });
      const files = [...new Set([...Object.keys(bundle), ...extra])].sort();
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource(precacheList(files)) });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [i18nParity(), releaseFiles()],
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(version) },
});
