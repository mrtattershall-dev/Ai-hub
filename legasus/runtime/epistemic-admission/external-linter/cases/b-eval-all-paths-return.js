export const classify = (xs) => xs.map((x) => {
  if (x > 0) return 'pos';
  if (x < 0) return 'neg';
  return 'zero';
});
export const picked = (xs) => xs.filter((x) => x % 2 === 0);
