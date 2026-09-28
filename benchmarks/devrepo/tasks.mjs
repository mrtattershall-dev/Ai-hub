// DEVELOPMENT REPOSITORY BENCHMARK — real code, mutated, with the pristine module as oracle.
//
// THIS IS A SACRIFICIAL BENCHMARK. Its purpose is not a score. It is to find out where Legasus breaks
// when the repository is no longer constructed around the experiment, so the architecture can be repaired
// against it - and then it is BURNED as development evidence and never used for the eventual claim.
//
// THE REPOSITORY is five modules of the Python 3.13 standard library: colorsys, bisect, calendar,
// textwrap, statistics. Real, mature code written by people who have never heard of Legasus. Tasks are
// created by MUTATING a real implementation; the task is to restore the real behaviour, or to add
// behaviour that was never there.
//
// THE ORACLE IS THE PRISTINE MODULE, executed. Not a reference patch, not a description, not anything
// derived from a candidate: the real library answering the same inputs. A candidate is correct only when
// it agrees with the real implementation on every probe, INCLUDING the probes that must raise.
//
// THE ENVELOPE FIELD IS DECLARED BEFORE ANY RUN, and it is a prediction, not a result:
//     IN         a guarded return over a single parameter - what Legasus is built for
//     BOUNDARY   plausibly reachable, but not the shape the pipeline was designed around
//     OUT        outside what this architecture can model at all; a REFUSAL is the correct output
//
// Getting IN tasks right is expected. The interesting numbers are what happens at BOUNDARY, and whether
// OUT produces a refusal rather than a bluff.
export const TASKS = [
  {
    id: 'T01', category: 'one-file behavioral bug', envelope: 'IN',
    module: 'calendar.py', fn: 'isleap',
    statement: 'The leap-year test is wrong for century years. A year divisible by 100 is NOT a leap year '
      + 'unless it is also divisible by 400. Fix isleap so it reports leap years correctly.',
    mutate: { find: 'return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)',
      replace: 'return year % 4 == 0' },
    call: 'isleap', probes: [[1896], [1900], [1904], [1999], [2000], [2024], [2100], [2400]],
  },
  {
    id: 'T02', category: 'preservation-sensitive', envelope: 'IN',
    module: 'statistics.py', fn: 'median_low',
    statement: 'median_low must raise StatisticsError when given empty data. That guard has been lost. '
      + 'Restore it without changing what median_low returns for non-empty data.',
    // Anchored on median_low's whole body: the empty-data guard alone occurs three times in this module,
    // and the validator requires exactly one occurrence rather than picking the first.
    mutate: { find: '    if n == 0:\n        raise StatisticsError("no median for empty data")\n'
      + '    if n % 2 == 1:\n        return data[n // 2]\n    else:\n        return data[n // 2 - 1]',
      replace: '    if n % 2 == 1:\n        return data[n // 2]\n    else:\n'
        + '        return data[n // 2 - 1]' },
    call: 'median_low', probes: [[[1, 3, 5]], [[1, 3, 5, 7]], [[2, 2, 2]], [[]], [[9]]],
  },
  {
    id: 'T03', category: 'tempting nearby code', envelope: 'IN',
    module: 'statistics.py', fn: 'median_high',
    statement: 'median_high returns the wrong one of the two middle values for even-length data. '
      + 'It must return the HIGHER of them. Fix median_high and leave median_low alone.',
    mutate: { find: '    return data[n // 2]\n\n\ndef median_grouped', replace: '    return data[(n - 1) // 2]\n\n\ndef median_grouped' },
    call: 'median_high', probes: [[[1, 3, 5]], [[1, 3, 5, 7]], [[4, 1, 2, 3]], [[9]]],
    alsoCheck: { call: 'median_low', probes: [[[1, 3, 5, 7]], [[4, 1, 2, 3]]] },
  },
  {
    id: 'T04', category: 'string / regex logic', envelope: 'BOUNDARY',
    module: 'textwrap.py', fn: 'dedent',
    statement: 'dedent must normalize entirely blank lines to a bare newline before computing the common '
      + 'margin. That step has been removed, so lines containing only whitespace now affect the result. '
      + 'Restore it.',
    mutate: { find: "    text = _whitespace_only_re.sub('', text)\n", replace: '' },
    call: 'dedent',
    probes: [['  a\n   \n  b\n'], ['    x\n\n    y\n'], ['\ta\n\tb\n'], ['no indent\n'],
      ['  a\n      \n  b\n']],
  },
  {
    id: 'T05', category: 'multi-parameter numeric', envelope: 'BOUNDARY',
    module: 'colorsys.py', fn: 'rgb_to_hls',
    statement: 'rgb_to_hls computes saturation with the wrong branch when lightness is above 0.5. '
      + 'For l greater than 0.5 the denominator must be 2.0 minus maxc minus minc. Fix it.',
    mutate: { find: '        s = rangec / (2.0-maxc-minc)  # Not always 2.0-sumc: gh-106498.',
      replace: '        s = rangec / sumc' },
    call: 'rgb_to_hls',
    probes: [[0.2, 0.4, 0.6], [0.9, 0.8, 0.7], [1.0, 1.0, 1.0], [0.0, 0.0, 0.0], [0.9, 0.1, 0.1],
      [0.5, 0.5, 0.6]],
  },
  {
    id: 'T06', category: 'locate the relevant code', envelope: 'BOUNDARY',
    module: null, fn: null,
    statement: 'Somewhere in this repository, the rule that decides which years have 366 days is wrong: '
      + 'it currently treats 1900 and 2100 as having 366 days. Find the responsible code and correct it.',
    mutate: { module: 'calendar.py',
      find: 'return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)',
      replace: 'return year % 4 == 0' },
    oracleModule: 'calendar.py', call: 'isleap',
    probes: [[1900], [2000], [2100], [2024], [1999]],
  },
  {
    id: 'T07', category: 'feature addition', envelope: 'BOUNDARY',
    module: 'statistics.py', fn: null,
    statement: 'Add a function midrange(data) to this module. It returns the arithmetic mean of the '
      + 'smallest and largest values, as a float. It must raise StatisticsError for empty data.',
    mutate: null, addition: true,
    call: 'midrange', probes: [[[1, 2, 3]], [[10, 0]], [[5]], [[]], [[-4, 4, 100]]],
    referenceImpl: 'def midrange(data):\n    data = list(data)\n    if not data:\n'
      + '        raise StatisticsError("midrange requires at least one data point")\n'
      + '    return (min(data) + max(data)) / 2\n',
  },
  {
    id: 'T08', category: 'DO NOT MODIFY', envelope: 'IN',
    module: 'bisect.py', fn: 'bisect_right',
    statement: 'Confirm that bisect_right inserts to the RIGHT of any equal entries, so that '
      + 'bisect_right([1,2,2,3], 2) is 3. If it already does, change nothing.',
    mutate: null, mustNotChange: true,
    call: 'bisect_right', probes: [[[1, 2, 2, 3], 2], [[1, 2, 2, 3], 0], [[], 5], [[1, 3], 2]],
  },
  {
    id: 'T09', category: 'multi-file', envelope: 'OUT',
    module: 'calendar.py', fn: 'isleap',
    statement: 'Fix the leap-year rule, and add a new module yearinfo.py exporting days_in_year(year) '
      + 'that returns 366 for leap years and 365 otherwise, importing the corrected rule rather than '
      + 'duplicating it.',
    mutate: { find: 'return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)',
      replace: 'return year % 4 == 0' },
    call: 'isleap', probes: [[1900], [2000], [2024]],
    extraModule: { name: 'yearinfo.py', call: 'days_in_year', probes: [[1900], [2000], [2024]],
      reference: 'from calendar import isleap\n\ndef days_in_year(year):\n'
        + '    return 366 if isleap(year) else 365\n' },
  },
  {
    id: 'T10', category: 'cannot be modelled', envelope: 'OUT',
    module: 'textwrap.py', fn: 'wrap',
    statement: 'Make textwrap.wrap safe to call concurrently from multiple threads without external '
      + 'locking, preserving current single-threaded behaviour exactly.',
    mutate: null, unmodellable: true,
    call: 'wrap', probes: [['hello world this is a test', 10]],
  },
  {
    id: 'T11', category: 'ambiguous decomposition', envelope: 'OUT',
    module: 'statistics.py', fn: 'mode',
    statement: 'Improve the error handling in mode.',
    mutate: null, ambiguous: true,
    call: 'mode', probes: [[[1, 1, 2]], [['a', 'b', 'a']], [[]]],
  },
  {
    // FOUND BY THE VALIDATOR, NOT DESIGNED. The original T12 mutated `insort_right` in bisect.py and the
    // validator reported it VOID: the mutation applied and changed nothing observable. The cause is that
    // `bisect.py` ends with `from _bisect import *`, so the names are rebound to a C accelerator and the
    // Python source is dead text.
    //
    //     THE FILE YOU EDIT MAY NOT BE THE CODE THAT RUNS.
    //
    // No synthetic family can produce that hazard, because the experimenter wrote every line. It is kept
    // as a task precisely because the correct behaviour is to NOTICE - an arm that edits the Python
    // source, observes no change, and reports success has committed a lie about the repository.
    id: 'T12', category: 'edit site is inert (C accelerator shadows it)', envelope: 'OUT',
    module: 'bisect.py', fn: 'insort_right',
    statement: 'insort_right should honour the lo and hi bounds when choosing the insertion point. '
      + 'Make sure it does.',
    mutate: { find: '        lo = bisect_right(a, x, lo, hi)', replace: '        lo = bisect_right(a, x)' },
    inertEditSite: true,
    call: null, mutating: true,
    mutatingProbes: [
      { setup: '[1, 3, 5, 7]', args: '2, 2, 4' },
      { setup: '[1, 3, 5, 7]', args: '6' },
      { setup: '[]', args: '1' },
      { setup: '[2, 2, 2]', args: '2, 1, 2' },
    ],
  },
];

export const ENVELOPE_COUNTS = TASKS.reduce((a, t) => {
  a[t.envelope] = (a[t.envelope] || 0) + 1;
  return a;
}, {});
