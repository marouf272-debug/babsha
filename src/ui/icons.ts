// Interface icons from lucide (ISC license, docs/LICENSES.md), the only icon set used (org rule).

import { Coins, createElement, Gift, Hammer, HandCoins, KeyRound, MapPin, TrafficCone, Undo2, Users, Volume2, VolumeX, Wallet, type IconNode } from 'lucide';

const ICONS: Record<string, IconNode> = {
  soundOn: Volume2, soundOff: VolumeX, collect: HandCoins, pay: Wallet, collectFromEach: Users, payEach: Gift,
  moveTo: MapPin, moveBy: Undo2, goToJam: TrafficCone, jamFreeCard: KeyRound, repairs: Hammer, coins: Coins,
};

export function icon(name: keyof typeof ICONS | string, size = 22, color = 'currentColor'): SVGElement {
  return createElement(ICONS[name] ?? Coins, { width: size, height: size, stroke: color, 'aria-hidden': 'true' });
}
