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
import { BoardScene } from './scene/board';
import { showcaseState } from './scene/showcase';
import { money, t, tIn } from './i18n';

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
  const sceneConfig = structuredClone(sceneDoc) as unknown as SceneConfig;
  // Camera preset from the address, for comparing presets on the phone (plan 3.6): ?camera=isometric
  const camera = params.get('camera');
  if (camera && camera in sceneConfig.camera.presets) sceneConfig.camera.active = camera;

  // Board-only pages for S5: ?showcase=1 (still sample position) and ?bench=1 (busy, with frame rate).
  if (params.get('showcase') === '1' || params.get('bench') === '1') {
    const bench = params.get('bench') === '1';
    const root = document.getElementById('app')!;
    const canvas = document.createElement('canvas');
    canvas.className = 'board showcase';
    canvas.style.cssText = 'width:100vw;height:100dvh;display:block';
    root.append(canvas);
    const fps = bench ? Object.assign(document.createElement('div'), { className: 'fps' }) : null;
    if (fps) root.append(fps);
    const rules = engine.rules;
    const scene = new BoardScene(canvas, rules, sceneConfig, () => ({
      font: '"Noto Sans Bengali", system-ui, sans-serif',
      tileName: (tile) => t(tile.nameKey),
      tileNote: (tile) => (tile.type === 'property' || tile.type === 'hub' || tile.type === 'utility' ? money(engine.quote(showcaseState(engine), tile.id).price) : ''),
      signName: (tile) => tIn('bn', tile.nameKey),
    }), { instant: !bench, fps });
    scene.sync(showcaseState(engine));
    if (bench) scene.benchmark();
    new ResizeObserver(() => scene.resize()).observe(canvas);
    document.title = t('app.title');
    return;
  }

  const ai = createAi(engine);
  const app = new App({
    root: document.getElementById('app')!,
    engine, ai,
    profiles: profilesDoc.profiles as Record<'easy' | 'medium' | 'hard', AiProfile>,
    sceneConfig,
    test,
    fps: params.get('fps') === '1',
  });
  if (test) (window as unknown as { __babsha: unknown }).__babsha = { app, engine, ai, profiles: profilesDoc.profiles };
}

// Offline play after the first visit (plan 2.2, D-94). Only in the production build, and only
// where the browser allows it (HTTPS or localhost).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* offline play is optional */ }); });
}

void main();
