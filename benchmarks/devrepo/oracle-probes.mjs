// THE FROZEN ORACLE PROBE SET — committed BEFORE any inference.
//
// The admission probes proved each mutation bites. These are the SCORING probes, and they are wider on
// purpose: a candidate that repairs the one witness the admission check happened to use while remaining
// wrong elsewhere must not score. So each task gets boundary values, near-boundary values, ordinary
// interior values, preserved special cases and out-of-domain values.
//
// Expected behaviour is never written here. It comes from EXECUTING THE PRISTINE MODULE on these inputs.
// The probe set is hidden from both arms; neither the raw model nor PROPOSE ever sees it.
export const ORACLE_PROBES = {
  T01: { call: 'isleap', module: 'calendar.py',
    args: [[1600], [1700], [1800], [1900], [1996], [1999], [2000], [2001], [2004], [2100], [2200],
      [2300], [2400], [0], [4], [100], [400], [-4], [-100], [-400]] },

  T02: { call: 'median_low', module: 'statistics.py',
    args: [[[1, 3, 5]], [[1, 3, 5, 7]], [[2, 2, 2]], [[]], [[9]], [[5, 1]], [[1, 2, 3, 4, 5, 6]],
      [[-3, -1]], [[0]], [[7, 7, 7, 7]], [[1.5, 2.5]], [[10, 2, 8, 4]]] },

  T03: { call: 'median_high', module: 'statistics.py',
    args: [[[1, 3, 5]], [[1, 3, 5, 7]], [[4, 1, 2, 3]], [[9]], [[]], [[5, 1]], [[1, 2, 3, 4, 5, 6]],
      [[-3, -1]], [[7, 7, 7, 7]], [[1.5, 2.5]], [[10, 2, 8, 4]]],
    alsoCheck: { call: 'median_low',
      args: [[[1, 3, 5, 7]], [[4, 1, 2, 3]], [[1, 3, 5]], [[5, 1]], [[1, 2, 3, 4, 5, 6]]] } },

  T04: { call: 'dedent', module: 'textwrap.py',
    args: [['  a\n   \n  b\n'], ['    x\n\n    y\n'], ['\ta\n\tb\n'], ['no indent\n'],
      ['  a\n      \n  b\n'], [''], ['\n'], ['   \n   \n'], ['  only one\n'],
      ['    deep\n  shallow\n'], ['\t mixed\n\t mixed\n'], ['  a\n\n\n  b\n']] },

  T05: { call: 'rgb_to_hls', module: 'colorsys.py',
    args: [[0.2, 0.4, 0.6], [0.9, 0.8, 0.7], [1.0, 1.0, 1.0], [0.0, 0.0, 0.0], [0.9, 0.1, 0.1],
      [0.5, 0.5, 0.6], [0.5, 0.5, 0.5], [0.51, 0.5, 0.5], [0.49, 0.5, 0.5], [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0], [0.0, 0.0, 1.0], [0.75, 0.75, 0.25], [0.6, 0.6, 0.6]] },

  T06: { call: 'isleap', module: 'calendar.py',
    args: [[1900], [2000], [2100], [2024], [1999], [1600], [1700], [2400], [4], [400]] },

  T07: { call: 'midrange', module: 'statistics.py',
    args: [[[1, 2, 3]], [[10, 0]], [[5]], [[]], [[-4, 4, 100]], [[2.5, 3.5]], [[0, 0]], [[-10, -2]]] },

  T08: { call: 'bisect_right', module: 'bisect.py',
    args: [[[1, 2, 2, 3], 2], [[1, 2, 2, 3], 0], [[], 5], [[1, 3], 2], [[1, 2, 2, 3], 3],
      [[1, 2, 2, 3], 4], [[2, 2, 2], 2]] },

  T09: { call: 'isleap', module: 'calendar.py',
    args: [[1900], [2000], [2024], [2100], [1996]] },

  T10: { call: 'wrap', module: 'textwrap.py',
    args: [['hello world this is a test', 10], ['short', 20], ['', 10],
      ['aaaaaaaaaaaaaaaaaaaa bbb', 5]] },

  T11: { call: 'mode', module: 'statistics.py',
    args: [[[1, 1, 2]], [['a', 'b', 'a']], [[]], [[3]], [[1, 2, 3]], [[2, 2, 3, 3]]] },

  T12: { module: 'bisect.py', mutating: true, fn: 'insort_right',
    mutatingArgs: [
      { setup: '[1, 3, 5, 7]', args: '2, 2, 4' },
      { setup: '[1, 3, 5, 7]', args: '6' },
      { setup: '[]', args: '1' },
      { setup: '[2, 2, 2]', args: '2, 1, 2' },
      { setup: '[1, 2, 3]', args: '0, 1, 3' },
      { setup: '[5, 6, 7]', args: '6, 0, 1' },
    ] },
};

// A task is scored PASS only when EVERY probe agrees with the pristine module, including the ones that
// must raise. One matching witness is not a repair.
export const SCORING_RULE = 'ALL_PROBES_MUST_AGREE_WITH_PRISTINE_EXECUTION';
