import { effectiveProbability, weightedValue } from './deals.mapper';

describe('deal weighting', () => {
  it('uses the stage probability unless overridden', () => {
    expect(effectiveProbability({ status: 'OPEN', probability: null }, 25)).toBe(25);
    expect(effectiveProbability({ status: 'OPEN', probability: 60 }, 25)).toBe(60);
  });

  it('treats won and lost deals as certain outcomes', () => {
    expect(effectiveProbability({ status: 'WON', probability: 10 }, 25)).toBe(100);
    expect(effectiveProbability({ status: 'LOST', probability: 90 }, 25)).toBe(0);
  });

  it('computes weighted values to cents', () => {
    expect(weightedValue(10000, 25)).toBe(2500);
    expect(weightedValue(999.99, 33)).toBe(330);
    expect(weightedValue(1234.5, 10)).toBe(123.45);
    expect(weightedValue(0, 50)).toBe(0);
  });
});
