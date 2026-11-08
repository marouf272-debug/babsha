// Mulberry32 pseudo random generator (D-27). The whole generator state is one 32-bit integer,
// stored in GameState.rng, so a game replays exactly from its state.

export function nextFloat(state: number): [value: number, next: number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export function rollDie(state: number, sides: number): [face: number, next: number] {
  const [v, next] = nextFloat(state);
  return [Math.floor(v * sides) + 1, next];
}

export function rollDice(state: number, count: number, sides: number): { dice: number[]; rng: number } {
  const dice: number[] = [];
  let s = state;
  for (let i = 0; i < count; i++) {
    const [face, next] = rollDie(s, sides);
    dice.push(face);
    s = next;
  }
  return { dice, rng: s };
}
