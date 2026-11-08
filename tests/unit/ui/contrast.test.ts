import { describe, expect, it } from 'vitest';
import scene from '../../../data/scene.json';
import { contrastRatio, INK, textOn } from '../../../src/ui/contrast';

describe('text on set colors (plan 2.2 contrast, D-96)', () => {
  it('plan 2.2: the contrast ratio matches the WCAG formula at the extremes', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('plan 2.2: tag and deed header text on every set color reaches 4.5 to 1', () => {
    for (const [group, color] of Object.entries(scene.colors.groups)) {
      const text = textOn(color);
      expect([INK, '#FFFFFF']).toContain(text);
      expect(contrastRatio(text, color), group).toBeGreaterThanOrEqual(4.5);
    }
  });
});
