import { describe, expect, it } from 'vitest';
import config from '../../data/config.json';

describe('config.json economy (plan 2.3 and 2.4)', () => {
  it('FR-01: 2 to 6 players, two six-sided dice, 40 tiles', () => {
    expect(config.players).toEqual({ min: 2, max: 6 });
    expect(config.dice.count).toBe(2);
    expect(config.dice.sides).toBe(6);
    expect(config.board.tiles).toBe(40);
  });
  it('FR-02: three doubles in a row go to Jam', () => {
    expect(config.dice.doublesToJam).toBe(3);
  });
  it('plan 2.4: start cash, GO salary, hub and utility prices, Super Tax', () => {
    expect(config.startCash).toBe(10000);
    expect(config.goSalary).toBe(2000);
    expect(config.hub.price).toBe(2000);
    expect(config.utility.price).toBe(1500);
    expect(config.tax.super).toBe(1000);
  });
  it('FR-05: hub rent 250, 500, 1000, 2000 and utility multiples 40 and 100', () => {
    expect(config.hub.rentByHubsOwned).toEqual([250, 500, 1000, 2000]);
    expect(config.utility.diceMultiplierByUtilitiesOwned).toEqual([40, 100]);
    expect(config.rent.unbuiltFullSetMultiplier).toBe(2);
  });
  it('FR-06: up to 4 houses then a hotel, sell back at 50 percent', () => {
    expect(config.building.maxHouses).toBe(4);
    expect(config.building.sellBackRate).toBe(0.5);
  });
  it('FR-07: mortgage at 50 percent, redeem at principal plus 10 percent', () => {
    expect(config.mortgage).toEqual({ rate: 0.5, redeemInterest: 0.1 });
  });
  it('FR-14, D-34, D-93: settings offer start cash choices around the default, and a 30 second timer that is off by default', () => {
    expect(config.settings.startCashOptions).toContain(config.startCash);
    expect([...config.settings.startCashOptions].sort((a, b) => a - b)).toEqual(config.settings.startCashOptions);
    expect(config.settings.startCashOptions.every((n) => n > 0 && n % 500 === 0)).toBe(true);
    expect(config.settings.timerSeconds).toBe(30);
    expect(config.settings.timerDefaultOn).toBe(false);
  });
  it('FR-04: auction opens at 0 with a minimum raise of 100', () => {
    expect(config.auction).toEqual({ openingBid: 0, minRaise: 100 });
  });
  it('FR-10, D-18: Jam fine 500 forced after 3 failed turns, City Tax 1000', () => {
    expect(config.jam).toEqual({ fine: 500, maxFailedTurns: 3 });
    expect(config.tax.city).toBe(1000);
    expect(config).not.toHaveProperty('assumptions');
  });
});
