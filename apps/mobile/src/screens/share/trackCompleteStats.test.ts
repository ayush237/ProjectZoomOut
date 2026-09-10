import { trackCompleteStats } from './trackCompleteStats';

/**
 * Tier A. This function's whole job is to not show a number the product does not
 * track — WP26's acceptance criterion is that an unobtainable stat is reported, not
 * approximated, and the only way to prove that in a test is to prove what this returns
 * when it is asked.
 */
describe('trackCompleteStats', () => {
  it('reports the day streak when the reader has one', () => {
    expect(trackCompleteStats(14)).toEqual([{ value: 14, label: 'Day streak' }]);
  });

  it('falls back to "Day one" for a zero streak, matching wrapUpStats', () => {
    expect(trackCompleteStats(0)).toEqual([{ value: 1, label: 'Day one' }]);
  });

  it('never returns more than the one stat the product can actually source', () => {
    // Documents the gap as behaviour, not just as a comment: XP earned and first-try
    // count have no Track-scoped source anywhere in the client-visible API, so there is
    // nothing this function could add for them without inventing a number.
    expect(trackCompleteStats(14)).toHaveLength(1);
  });
});
