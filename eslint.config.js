import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    // Plan 3.1 and 3.4: the rules engine never imports the scene, the interface, audio or Three.js.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'The engine must not import Three.js.' },
            { group: ['**/scene/**', '**/ui/**', '**/audio/**', '**/ai/**', '**/i18n/**'], message: 'The engine must not import the scene, interface, audio, AI or i18n layers.' },
          ],
        },
      ],
    },
  },
  {
    // Plan 3.4: AI profiles only call the engine.
    files: ['src/ai/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: 'AI must not import Three.js.' },
            { group: ['**/scene/**', '**/ui/**', '**/audio/**'], message: 'AI may only import the engine.' },
          ],
        },
      ],
    },
  },
);
