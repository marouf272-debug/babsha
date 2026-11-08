import { t } from './i18n';

// Sprint 0 placeholder entry point. All visible text comes from the language files.
document.title = t('app.title');
const app = document.getElementById('app');
if (app) {
  const h1 = document.createElement('h1');
  h1.textContent = t('app.title');
  const p = document.createElement('p');
  p.textContent = t('app.buildStatus');
  app.append(h1, p);
}
