// Function to count the number of 1-bits in the binary representation of a non-negative integer
function countBits(n) {
    if (n < 0) {
        throw new Error("Input must be a non-negative integer");
    }
    
    let count = 0;
    while (n > 0) {
        count += n & 1;  // Check if the least significant bit is 1
        n >>= 1;         // Right shift to check the next bit
    }
    return count;
}

// Function to check if a non-negative integer is a power of two
function isPowerOfTwo(n) {
    if (n < 0) {
        throw new Error("Input must be a non-negative integer");
    }
    
    // A number is a power of two if it has exactly one bit set
    // For n > 0, n & (n-1) will be 0 if n is a power of two
    return n > 0 && (n & (n - 1)) === 0;
}

// Assertions to test the functions
console.assert(countBits(0) === 0, "countBits(0) should be 0");
console.assert(countBits(1) === 1, "countBits(1) should be 1");
console.assert(countBits(2) === 1, "countBits(2) should be 1");
console.assert(countBits(3) === 2, "countBits(3) should be 2");
console.assert(countBits(4) === 1, "countBits(4) should be 1");
console.assert(countBits(5) === 2, "countBits(5) should be 2");
console.assert(countBits(7) === 3, "countBits(7) should be 3");
console.assert(countBits(8) === 1, "countBits(8) should be 1");
console.assert(countBits(15) === 4, "countBits(15) should be 4");
console.assert(countBits(16) === 1, "countBits(16) should be 1");

console.assert(isPowerOfTwo(0) === false, "isPowerOfTwo(0) should be false");
console.assert(isPowerOfTwo(1) === true, "isPowerOfTwo(1) should be true");
console.assert(isPowerOfTwo(2) === true, "isPowerOfTwo(2) should be true");
console.assert(isPowerOfTwo(3) === false, "isPowerOfTwo(3) should be false");
console.assert(isPowerOfTwo(4) === true, "isPowerOfTwo(4) should be true");
console.assert(isPowerOfTwo(5) === false, "isPowerOfTwo(5) should be false");
console.assert(isPowerOfTwo(8) === true, "isPowerOfTwo(8) should be true");
console.assert(isPowerOfTwo(15) === false, "isPowerOfTwo(15) should be false");
console.assert(isPowerOfTwo(16) === true, "isPowerOfTwo(16) should be true");
console.assert(isPowerOfTwo(32) === true, "isPowerOfTwo(32) should be true");

// Export the functions for use in other modules
module.exports = { countBits, isPowerOfTwo };