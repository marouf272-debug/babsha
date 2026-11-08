// Response curves for utility scoring (ai-behavior-trees-utility-ai skill). All return 0..1.

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Maps x linearly from [from, to] onto [0, 1], clamped. `to` may be below `from`.
export const linear = (x: number, from: number, to: number) => (to === from ? (x >= to ? 1 : 0) : clamp01((x - from) / (to - from)));

// Compensation for multiplying several 0..1 considerations, so each extra factor does not
// drag the score toward zero. A zero still vetoes.
export function compensate(product: number, count: number): number {
  if (count <= 1) return product;
  const modification = 1 - 1 / count;
  const makeUp = (1 - product) * modification;
  return product + makeUp * product;
}
