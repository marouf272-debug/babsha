import '@fontsource/noto-sans-bengali/400.css';
import '@fontsource/noto-sans-bengali/700.css';
import './ui/styles.css';
import tilesDoc from '../data/tiles.json';
import config from '../data/config.json';
import cardsDoc from '../data/cards.json';
import profilesDoc from '../data/ai-profiles.json';
import sceneDoc from '../data/scene.json';
import { createEngine, makeRules } from './engine';
import { createAi, type AiProfile } from './ai';
import { setLang, type Lang } from './i18n';
import { App } from './ui/app';
import type { SceneConfig } from './scene/config';

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const test = params.get('test') === '1';
  let saved: string | null = null;
  try { saved = localStorage.getItem('babsha.lang'); } catch { /* storage may be blocked */ }
  const lang = (params.get('lang') ?? saved) as Lang | null;
  if (lang === 'en' || lang === 'bn') setLang(lang);

  // Bangla tile signs are drawn on canvas, so the font must be loaded before the first draw.
  try {
    await Promise.all([document.fonts.load('600 20px "Noto Sans Bengali"', 'বাংলা'), document.fonts.load('400 20px "Noto Sans Bengali"', 'বাংলা')]);
  } catch { /* fall back to system fonts */ }

  const engine = createEngine(makeRules(tilesDoc, config, cardsDoc));
  const ai = createAi(engine);
  const app = new App({
    root: document.getElementById('app')!,
    engine, ai,
    profiles: profilesDoc.profiles as Record<'easy' | 'medium' | 'hard', AiProfile>,
    sceneConfig: sceneDoc as unknown as SceneConfig,
    test,
  });
  if (test) (window as unknown as { __babsha: unknown }).__babsha = { app, engine, ai, profiles: profilesDoc.profiles };
}

void main();
