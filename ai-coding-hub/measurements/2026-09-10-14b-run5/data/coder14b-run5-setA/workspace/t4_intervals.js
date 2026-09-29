function mergeIntervals(intervals) {
  if (intervals.length < 2) {
    return intervals;
  }

  // Sort the intervals by start time
  intervals.sort((a, b) => a[0] - b[0]);

  const mergedIntervals = [intervals[0]];

  for (let i = 1; i < intervals.length; i++) {
    const currentInterval = intervals[i];
    const lastMergedInterval = mergedIntervals[mergedIntervals.length - 1];

    if (currentInterval[0] <= lastMergedInterval[1]) {
      // Overlapping intervals, merge them
      lastMergedInterval[1] = Math.max(lastMergedInterval[1], currentInterval[1]);
    } else {
      // Non-overlapping intervals, add the current interval to the merged list
      mergedIntervals.push(currentInterval);
    }
  }

  return mergedIntervals;
}{ mergeIntervals }