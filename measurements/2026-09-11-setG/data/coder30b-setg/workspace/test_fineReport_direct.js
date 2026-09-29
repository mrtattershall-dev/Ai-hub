// Direct implementation of fineReport function to test it
function fineReport(library, members) {
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
}

// Test with mock data
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

const members = ['Alice', 'Bob', 'Charlie', 'David'];

console.log('Testing fineReport directly:');
const result = fineReport(mockLibrary, members);
console.log('Result:');
console.log(result);

console.log('\nExpected:');
console.log('Charlie: $2.25');
console.log('Alice: $1.50');
console.log('Bob: $0.75');
console.log('David: $0.00');