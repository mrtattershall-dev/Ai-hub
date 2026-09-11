// t4_intervals.js - Merge overlapping intervals

function mergeIntervals(list) {
    // Handle edge cases
    if (!list || list.length <= 1) {
        return list;
    }
    
    // Sort intervals by start time
    const sorted = list.sort((a, b) => a[0] - b[0]);
    
    // Merge overlapping intervals
    const merged = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const lastMerged = merged[merged.length - 1];
        
        // If current interval overlaps with the last merged interval
        if (current[0] <= lastMerged[1]) {
            // Merge them by extending the end time
            lastMerged[1] = Math.max(lastMerged[1], current[1]);
        } else {
            // No overlap, add current interval
            merged.push(current);
        }
    }
    
    return merged;
}

// Export the function
module.exports = { mergeIntervals };