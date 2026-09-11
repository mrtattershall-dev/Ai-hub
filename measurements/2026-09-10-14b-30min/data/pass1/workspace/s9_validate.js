// s9_validate.js

function isEmail(str) {
    // Simple email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(str);
}

function isStrongPassword(str) {
    // Password must be 8+ characters with a digit, an upper-case and a lower-case letter
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
    return passwordRegex.test(str);
}

// Assertions
console.assert(isEmail("test@example.com"), "isEmail should return true for valid email");
console.assert(!isEmail("invalid-email"), "isEmail should return false for invalid email");
console.assert(isStrongPassword("StrongPass1"), "isStrongPassword should return true for strong password");
console.assert(!isStrongPassword("weak"), "isStrongPassword should return false for weak password");
console.assert(!isStrongPassword("NoDigit"), "isStrongPassword should return false for password without digit");
console.assert(!isStrongPassword("Nouppercase"), "isStrongPassword should return false for password without uppercase");
console.assert(!isStrongPassword("nolowercase"), "isStrongPassword should return false for password without lowercase");
console.assert(!isStrongPassword("Short1"), "isStrongPassword should return false for short password");

console.log("All assertions passed!");