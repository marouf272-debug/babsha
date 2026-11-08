// A fixed sample position for screenshots and the frame-rate benchmark (S5): six players,
// owned sets with houses and hotels, a mortgage, the Dark Blue group built up.

import type { Engine, GameState } from '../engine';

export function showcaseState(engine: Engine): GameState {
  const s = structuredClone(engine.newGame({ playerIds: ['a', 'b', 'c', 'd', 'e', 'f'], seed: 7 }).state);
  const own = (id: string, owner: number, houses = 0, mortgaged = false) => { s.properties[id] = { owner, houses, mortgaged }; };
  own('gulshan', 0, 3); own('baridhara', 0, 5);
  own('dhanmondi', 1, 2); own('banani', 1, 2); own('uttara', 1, 2);
  own('mirpur', 2); own('mohammadpur', 2, 0, true);
  own('kamalapur', 3); own('sadarghat', 3); own('desco', 4); own('tsc', 5, 0); own('paltan', 5);
  own('puran_dhaka', 2, 1); own('chawk_bazar', 2, 1);
  [38, 36, 24, 10, 15, 0].forEach((pos, i) => { s.players[i]!.position = pos; });
  s.players[3]!.inJam = true;
  s.turn.lastDice = [3, 5];
  return s;
}
