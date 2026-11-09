// The web app manifest that makes the game installable from the browser (plan phase 6, D-102).
// Pure; vite.config.ts writes it into the build next to the icons from assets/icons.

export interface IconSpec { file: string; size: number; purpose: 'any' | 'maskable' | 'apple' }

export const ICONS: IconSpec[] = [
  { file: 'icons/icon-192.png', size: 192, purpose: 'any' },
  { file: 'icons/icon-512.png', size: 512, purpose: 'any' },
  { file: 'icons/icon-maskable-512.png', size: 512, purpose: 'maskable' },
  // iOS ignores manifest icons for the home screen and reads this link instead.
  { file: 'icons/apple-touch-icon.png', size: 180, purpose: 'apple' },
];

export interface ManifestInput { name: string; lang: string; themeColor: string; backgroundColor: string; orientation: string }

export function webManifest(m: ManifestInput) {
  return {
    id: './',
    name: m.name,
    short_name: m.name,
    lang: m.lang,
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: m.orientation,
    background_color: m.backgroundColor,
    theme_color: m.themeColor,
    icons: ICONS.filter((i) => i.purpose !== 'apple').map((i) => ({ src: i.file, sizes: `${i.size}x${i.size}`, type: 'image/png', purpose: i.purpose })),
  };
}

// The tags added to index.html so browsers find the manifest and iOS finds its icon.
export function headTags(themeColor: string) {
  const apple = ICONS.find((i) => i.purpose === 'apple')!;
  const small = ICONS.find((i) => i.size === 192)!;
  return [
    { tag: 'link', attrs: { rel: 'manifest', href: 'manifest.webmanifest' } },
    { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: small.file } },
    { tag: 'link', attrs: { rel: 'apple-touch-icon', href: apple.file } },
    { tag: 'meta', attrs: { name: 'theme-color', content: themeColor } },
  ];
}
