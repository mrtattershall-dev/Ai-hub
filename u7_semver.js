function compare(a, b) {
    // Split version strings into arrays of numbers
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    // Compare each part numerically
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aNum = i < aParts.length ? aParts[i] : 0;
        const bNum = i < bParts.length ? bParts[i] : 0;
        
        if (aNum < bNum) return -1;
        if (aNum > bNum) return 1;
    }
    
    return 0;
}

module.exports = { compare };