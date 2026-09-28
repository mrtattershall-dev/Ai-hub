// A DIRECT TEST OF AN INTERACTION, because "significant here and not significant there" is not one.
//
// THE MISTAKE THIS EXISTS TO PREVENT, and this project has already made it once. Window 7 read a
// p = 0.25 null as evidence of no effect; window 8 showed the effect was there and the sample could not
// have seen it. The same error is available in a nastier form when comparing two subgroups: an effect
// significant at FULL and not significant at W1 is NOT evidence that the two differ. Two results on
// opposite sides of an arbitrary threshold can be statistically indistinguishable from each other.
//
// So the interaction gets its own test: does the effect of the ARM differ between the two WINDOWS?
//
//     logit p = b0 + b1*window + b2*arm            additive - one arm effect, shared by both windows
//     logit p = b0 + b1*window + b2*arm + b3*both  saturated - the arm effect may differ
//
// With four cells the saturated model fits exactly, so the likelihood-ratio statistic for b3 is just
// the additive model's residual deviance, on 1 degree of freedom. Large deviance means one arm effect
// cannot describe both windows: an interaction.
//
// ASYMPTOTIC, and said out loud rather than buried. The chi-square reference distribution is an
// approximation; at these cell sizes it is reasonable but it is not exact, and a p near the threshold
// should be treated as a prompt to collect more data rather than as a verdict.

// Abramowitz & Stegun 7.1.26 - enough precision for a reported p-value, and no dependency.
function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const y = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418
    + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587
    + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? y : 2 - y;
}

// P(chi-square with 1 df > x). chi2_1 is Z squared, so this is the two-sided normal tail.
export function chiSqP1(x) {
  if (!(x > 0)) return 1;
  return erfc(Math.sqrt(x / 2));
}

const logit = (p) => Math.log(p / (1 - p));

// Iteratively reweighted least squares for a logistic model over grouped binomial cells.
// Each cell is { x: [predictors], k: successes, n: trials }. Returns the fitted deviance.
function fitDeviance(cells, nPred) {
  let beta = new Array(nPred).fill(0);
  for (let iter = 0; iter < 200; iter++) {
    const XtWX = Array.from({ length: nPred }, () => new Array(nPred).fill(0));
    const XtWz = new Array(nPred).fill(0);
    for (const c of cells) {
      const eta = c.x.reduce((s, xi, i) => s + xi * beta[i], 0);
      const p = 1 / (1 + Math.exp(-eta));
      const w = c.n * p * (1 - p);
      if (w < 1e-12) continue;
      const z = eta + (c.k - c.n * p) / w;
      for (let i = 0; i < nPred; i++) {
        XtWz[i] += w * c.x[i] * z;
        for (let j = 0; j < nPred; j++) XtWX[i][j] += w * c.x[i] * c.x[j];
      }
    }
    // Gaussian elimination with partial pivoting; ridge only if the system is singular.
    const A = XtWX.map((row, i) => [...row, XtWz[i]]);
    for (let i = 0; i < nPred; i++) A[i][i] += 1e-10;
    for (let i = 0; i < nPred; i++) {
      let piv = i;
      for (let r = i + 1; r < nPred; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
      [A[i], A[piv]] = [A[piv], A[i]];
      for (let r = 0; r < nPred; r++) {
        if (r === i) continue;
        const f = A[r][i] / A[i][i];
        for (let cc = i; cc <= nPred; cc++) A[r][cc] -= f * A[i][cc];
      }
    }
    const next = A.map((row, i) => row[nPred] / row[i]);
    const delta = Math.max(...next.map((v, i) => Math.abs(v - beta[i])));
    beta = next;
    if (delta < 1e-10) break;
  }
  let dev = 0;
  for (const c of cells) {
    const eta = c.x.reduce((s, xi, i) => s + xi * beta[i], 0);
    const p = Math.min(1 - 1e-12, Math.max(1e-12, 1 / (1 + Math.exp(-eta))));
    const k = c.k; const n = c.n;
    if (k > 0) dev += 2 * k * Math.log(k / (n * p));
    if (k < n) dev += 2 * (n - k) * Math.log((n - k) / (n * (1 - p)));
  }
  return { deviance: dev, beta };
}

// counts: { a00, n00, a01, n01, a10, n10, a11, n11 } indexed [window][arm], 0 = reference level.
export function interactionTest(counts) {
  const cells = [
    { x: [1, 0, 0, 0], k: counts.a00, n: counts.n00 },
    { x: [1, 0, 1, 0], k: counts.a01, n: counts.n01 },
    { x: [1, 1, 0, 0], k: counts.a10, n: counts.n10 },
    { x: [1, 1, 1, 1], k: counts.a11, n: counts.n11 },
  ];
  const additive = fitDeviance(cells.map((c) => ({ ...c, x: c.x.slice(0, 3) })), 3);
  const stat = additive.deviance;
  const rate = (k, n) => (n ? k / n : NaN);
  return {
    statistic: stat,
    df: 1,
    p: chiSqP1(stat),
    difference_in_differences:
      (rate(counts.a11, counts.n11) - rate(counts.a10, counts.n10))
      - (rate(counts.a01, counts.n01) - rate(counts.a00, counts.n00)),
    rates: {
      window0_arm0: rate(counts.a00, counts.n00), window0_arm1: rate(counts.a01, counts.n01),
      window1_arm0: rate(counts.a10, counts.n10), window1_arm1: rate(counts.a11, counts.n11),
    },
    note: 'asymptotic likelihood-ratio test of the window x arm term; not exact at small cell counts',
  };
}
