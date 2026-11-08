import { describe, expect, it } from 'vitest';
import { engine, managing } from './helpers';

describe('price quotes for the interface (FR-03, FR-06, FR-07)', () => {
  it('FR-03, FR-07: gives price, mortgage value and redeem cost', () => {
    const q = engine.quote(managing(), 'chawk_bazar');
    expect(q).toMatchObject({ price: 600, mortgageValue: 300, redeemCost: 330 });
    expect(engine.quote(managing(), 'kamalapur')).toMatchObject({ price: 2000, mortgageValue: 1000, redeemCost: 1100 });
  });

  it('FR-06: gives the cost of the next building and the refund for selling one', () => {
    const s = managing({ puran_dhaka: { houses: 4 }, chawk_bazar: { houses: 5 } });
    expect(engine.quote(s, 'puran_dhaka')).toMatchObject({ buildCost: 500, sellRefund: 250 });
    expect(engine.quote(s, 'chawk_bazar')).toMatchObject({ buildCost: null, sellRefund: 250 });
    expect(engine.quote(managing(), 'kamalapur')).toMatchObject({ buildCost: null, sellRefund: null });
  });
});
