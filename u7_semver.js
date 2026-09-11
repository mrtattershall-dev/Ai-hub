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
    
    // If we get here, the numeric parts are equal
    // Check for pre-release identifiers
    const aHasPreRelease = a.includes('-');
    const bHasPreRelease = b.includes('-');
    
    // If only one has a pre-release, the one without it is greater
    if (aHasPreRelease && !bHasPreRelease) return -1;
    if (!aHasPreRelease && bHasPreRelease) return 1;
    
    // If both have pre-releases, compare them
    if (aHasPreRelease && bHasPreRelease) {
        const aPreRelease = a.split('-')[1];
        const bPreRelease = b.split('-')[1];
        
        // For simplicity, we'll treat pre-release identifiers as strings
        // In a real semver implementation, this would be more complex
        if (aPreRelease < bPreRelease) return -1;
        if (aPreRelease > bPreRelease) return 1;
    }
    
    return 0;
}

module.exports = { compare };