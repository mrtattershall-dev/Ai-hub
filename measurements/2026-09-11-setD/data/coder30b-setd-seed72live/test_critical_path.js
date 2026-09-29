const { TaskGraph } = require('./r3_tasks.js');

// Test criticalPath method
const criticalPathGraph = new TaskGraph();
criticalPathGraph.add('A', 5)
                .add('B', 3)
                .add('C', 4)
                .add('D', 2)
                .depend('B', 'A')
                .depend('C', 'A')
                .depend('D', 'B');

const path = criticalPathGraph.criticalPath();
console.log('Critical path:', path);
console.assert(path.length === 3, 'Critical path should have 3 tasks');
console.assert(path[0] === 'A', 'First task in critical path should be A');
console.assert(path[1] === 'B', 'Second task in critical path should be B');
console.assert(path[2] === 'D', 'Third task in critical path should be D');

console.log('All tests passed!');