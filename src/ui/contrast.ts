// Text color for a colored background (plan 2.2: contrast checked on every text and background
// pair, D-96). Uses the WCAG 2 relative luminance and contrast ratio formulas.

export const INK = '#1E1B18'; // --ink in styles.css

function luminance(hex: string): number {
  const v = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// White or ink, whichever reads better on the background.
export function textOn(background: string): string {
  return contrastRatio('#FFFFFF', background) >= contrastRatio(INK, background) ? '#FFFFFF' : INK;
}
