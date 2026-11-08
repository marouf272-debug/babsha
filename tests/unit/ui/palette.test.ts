import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import scene from '../../../data/scene.json';

describe('style guide palette (docs/style-guide.md section 2)', () => {
  it('every palette token in data/scene.json has the same value as its CSS variable', () => {
    const css = readFileSync(join(import.meta.dirname, '..', '..', '..', 'src', 'ui', 'styles.css'), 'utf8');
    for (const [name, value] of Object.entries(scene.colors.palette)) {
      const m = css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
      expect(m?.[1]?.toUpperCase(), name).toBe(value.toUpperCase());
    }
  });
});
