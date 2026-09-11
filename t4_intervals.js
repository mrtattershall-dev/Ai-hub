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

// Test asserts
function runTests() {
    // Test case 1: Basic overlapping intervals
    const test1 = [[1, 3], [2, 6], [8, 10], [15, 18]];
    const expected1 = [[1, 6], [8, 10], [15, 18]];
    const result1 = mergeIntervals(test1);
    console.assert(JSON.stringify(result1) === JSON.stringify(expected1), 
        "Test 1 failed:", result1, "expected:", expected1);
    
    // Test case 2: Multiple overlaps
    const test2 = [[1, 4], [4, 5]];
    const expected2 = [[1, 5]];
    const result2 = mergeIntervals(test2);
    console.assert(JSON.stringify(result2) === JSON.stringify(expected2), 
        "Test 2 failed:", result2, "expected:", expected2);
    
    // Test case 3: No overlaps
    const test3 = [[1, 2], [3, 4], [5, 6]];
    const expected3 = [[1, 2], [3, 4], [5, 6]];
    const result3 = mergeIntervals(test3);
    console.assert(JSON.stringify(result3) === JSON.stringify(expected3), 
        "Test 3 failed:", result3, "expected:", expected3);
    
    // Test case 4: Empty array
    const test4 = [];
    const expected4 = [];
    const result4 = mergeIntervals(test4);
    console.assert(JSON.stringify(result4) === JSON.stringify(expected4), 
        "Test 4 failed:", result4, "expected:", expected4);
    
    // Test case 5: Single interval
    const test5 = [[1, 5]];
    const expected5 = [[1, 5]];
    const result5 = mergeIntervals(test5);
    console.assert(JSON.stringify(result5) === JSON.stringify(expected5), 
        "Test 5 failed:", result5, "expected:", expected5);
    
    // Test case 6: Complex overlaps
    const test6 = [[1, 3], [2, 4], [5, 7], [6, 8], [9, 10]];
    const expected6 = [[1, 4], [5, 8], [9, 10]];
    const result6 = mergeIntervals(test6);
    console.assert(JSON.stringify(result6) === JSON.stringify(expected6), 
        "Test 6 failed:", result6, "expected:", expected6);
    
    console.log("All tests passed!");
}

// Export the function
module.exports = { mergeIntervals };

// Run tests
runTests();