// Test the fineReport function directly
const fs = require('fs');

// Read the s10_desk.js file to get the function
const content = fs.readFileSync('./s10_desk.js', 'utf8');

// Extract just the fineReport function
const functionMatch = content.match(/function fineReport\(library, members\) \{[\s\S]*?\}/);
if (functionMatch) {
  console.log("fineReport function found:");
  console.log(functionMatch[0]);
  
  // Create a mock library for testing
  const mockLibrary = {
    fines: function(member) {
      const fineData = {
        'Alice': 150,
        'Bob': 75,
        'Charlie': 225,
        'David': 0
      };
      return fineData[member] || 0;
    }
  };
  
  // Test the function
  const members = ['Alice', 'Bob', 'Charlie', 'David'];
  
  // Manually implement the function logic to test it
  const fineReport = function(library, members) {
    // Collect members with fines
    const membersWithFines = [];
    
    for (const member of members) {
      const fines = library.fines(member);
      if (fines > 0) {
        membersWithFines.push({ member, fines });
      }
    }
    
    // Sort by fines (descending) then by member name (ascending)
    membersWithFines.sort((a, b) => {
      if (b.fines !== a.fines) {
        return b.fines - a.fines; // Descending by fines
      }
      return a.member.localeCompare(b.member); // Ascending by name
    });
    
    // Format the output
    return membersWithFines.map(item => `${item.member}: $${(item.fines / 100).toFixed(2)}`).join('\n');
  };
  
  const result = fineReport(mockLibrary, members);
  console.log('\nResult:');
  console.log(result);
  
  console.log('\nExpected:');
  console.log('Charlie: $2.25');
  console.log('Alice: $1.50');
  console.log('Bob: $0.75');
} else {
  console.log("fineReport function not found in s10_desk.js");
}