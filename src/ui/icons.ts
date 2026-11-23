// Interface icons from lucide (ISC license, docs/LICENSES.md), the only icon set used (org rule).

import { Bike, Bus, CarFront, Coffee, Coins, createElement, Fish, Menu, Wind, Gift, Hammer, HandCoins, KeyRound, MapPin, RotateCcw, ScrollText, Timer, TrafficCone, Undo2, Users, Volume2, VolumeX, Wallet, type IconNode } from 'lucide';

const ICONS: Record<string, IconNode> = {
  soundOn: Volume2, soundOff: VolumeX, collect: HandCoins, pay: Wallet, collectFromEach: Users, payEach: Gift,
  moveTo: MapPin, moveBy: Undo2, goToJam: TrafficCone, jamFreeCard: KeyRound, repairs: Hammer, coins: Coins, log: ScrollText, timer: Timer, newGame: RotateCcw, menu: Menu,
  // Player tokens (plan 2.4), shown on the player cards in the Night Map look.
  rickshaw: Bike, cng: CarFront, ilish: Fish, kite: Wind, tea_cup: Coffee, bus: Bus,
};

export function icon(name: keyof typeof ICONS | string, size = 22, color = 'currentColor'): SVGElement {
  return createElement(ICONS[name] ?? Coins, { width: size, height: size, stroke: color, 'aria-hidden': 'true' });
}
