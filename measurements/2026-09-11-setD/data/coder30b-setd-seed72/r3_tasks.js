class TaskGraph {
    constructor() {
        this.tasks = new Map();
        this.dependencies = new Map();
    }
    
    add(id, duration) {
        if (this.tasks.has(id)) {
            throw new Error(`Task with id '${id}' already exists`);
        }
        if (typeof duration !== 'number' || duration <= 0) {
            throw new Error(`Duration must be a positive number, got ${duration}`);
        }
        this.tasks.set(id, duration);
        return this;
    }
    
    has(id) {
        return this.tasks.has(id);
    }
    
    size() {
        return this.tasks.size;
    }
    
    depend(id, onId) {
        if (!this.tasks.has(id)) {
            throw new Error(`Task with id '${id}' does not exist`);
        }
        if (!this.tasks.has(onId)) {
            throw new Error(`Task with id '${onId}' does not exist`);
        }
        if (id === onId) {
            throw new Error(`Task cannot depend on itself`);
        }
        
        // Check for cycles before adding the dependency
        if (this._hasCycle(id, onId)) {
            throw new Error(`Adding dependency would create a cycle`);
        }
        
        if (!this.dependencies.has(id)) {
            this.dependencies.set(id, new Set());
        }
        this.dependencies.get(id).add(onId);
        return this;
    }
    
    _hasCycle(id, onId) {
        // Perform DFS to check if adding this dependency would create a cycle
        const visited = new Set();
        const stack = [onId];
        
        while (stack.length > 0) {
            const current = stack.pop();
            
            if (current === id) {
                // We've found a path back to the original task, so there's a cycle
                return true;
            }
            
            if (visited.has(current)) {
                continue;
            }
            
            visited.add(current);
            
            // Add dependencies of current task to stack
            if (this.dependencies.has(current)) {
                for (const dep of this.dependencies.get(current)) {
                    stack.push(dep);
                }
            }
        }
        
        return false;
    }
    
    order() {
        // Create a copy of dependencies to avoid modifying the original
        const inDegree = new Map();
        const graph = new Map();
        
        // Initialize in-degree map and adjacency list
        for (const [id] of this.tasks) {
            inDegree.set(id, 0);
            graph.set(id, []);
        }
        
        // Calculate in-degrees and build adjacency list
        for (const [id, deps] of this.dependencies) {
            for (const dep of deps) {
                inDegree.set(id, inDegree.get(id) + 1);
                if (!graph.has(dep)) {
                    graph.set(dep, []);
                }
                graph.get(dep).push(id);
            }
        }
        
        // Initialize queue with tasks that have no dependencies
        const queue = [];
        const result = [];
        
        for (const [id, degree] of inDegree) {
            if (degree === 0) {
                queue.push(id);
            }
        }
        
        // Process tasks in topological order
        while (queue.length > 0) {
            // Get the first task (FIFO order)
            const id = queue.shift();
            result.push(id);
            
            // For each dependent task, reduce its in-degree
            if (graph.has(id)) {
                for (const dependent of graph.get(id)) {
                    inDegree.set(dependent, inDegree.get(dependent) - 1);
                    // If in-degree becomes 0, add to queue
                    if (inDegree.get(dependent) === 0) {
                        queue.push(dependent);
                    }
                }
            }
        }
        
        // Check for cycles
        if (result.length !== this.tasks.size) {
            throw new Error('Cycle detected in task dependencies');
        }
        
        return result;
    }
    
    totalTime() {
        // If there are no tasks, return 0
        if (this.tasks.size === 0) {
            return 0;
        }
        
        // Use topological sorting to compute earliest finish times
        // This is a classic critical path calculation
        
        // For each task, track the earliest time it can finish
        const earliestFinishTime = new Map();
        
        // Initialize with task durations (earliest finish time for tasks with no dependencies)
        for (const [id, duration] of this.tasks) {
            earliestFinishTime.set(id, duration);
        }
        
        // Process tasks in topological order
        const orderedTasks = this.order();
        
        // For each task in topological order, update the earliest finish time of its dependents
        for (const taskId of orderedTasks) {
            const taskDuration = this.tasks.get(taskId);
            const finishTime = earliestFinishTime.get(taskId);
            
            // For each dependent task, update its earliest finish time
            for (const [dependentId, dependencies] of this.dependencies) {
                if (dependencies.has(taskId)) {
                    // The earliest finish time for the dependent task is the max of:
                    // 1. Current earliest finish time for dependent task
                    // 2. Finish time of the dependency + duration of the dependent task
                    const newFinishTime = finishTime + this.tasks.get(dependentId);
                    const currentFinishTime = earliestFinishTime.get(dependentId);
                    earliestFinishTime.set(dependentId, Math.max(currentFinishTime, newFinishTime));
                }
            }
        }
        
        // The total time is the maximum finish time among all tasks
        let maxTime = 0;
        for (const time of earliestFinishTime.values()) {
            maxTime = Math.max(maxTime, time);
        }
        
        return maxTime;
    }
}

// Export the TaskGraph class
module.exports = { TaskGraph };

// Asserts to verify functionality
const taskGraph = new TaskGraph();

// Test add method
taskGraph.add('task1', 10);
taskGraph.add('task2', 20);
taskGraph.add('task3', 15);

// Test has method
console.assert(taskGraph.has('task1') === true, 'task1 should exist');
console.assert(taskGraph.has('task4') === false, 'task4 should not exist');

// Test size method
console.assert(taskGraph.size() === 3, 'Size should be 3');

// Test error for duplicate ID
try {
    taskGraph.add('task1', 30);
    console.assert(false, 'Should have thrown an error for duplicate ID');
} catch (e) {
    console.assert(e.message.includes('already exists'), 'Should throw error for duplicate ID');
}

// Test error for non-positive duration
try {
    taskGraph.add('task4', -5);
    console.assert(false, 'Should have thrown an error for negative duration');
} catch (e) {
    console.assert(e.message.includes('positive number'), 'Should throw error for negative duration');
}

try {
    taskGraph.add('task5', 0);
    console.assert(false, 'Should have thrown an error for zero duration');
} catch (e) {
    console.assert(e.message.includes('positive number'), 'Should throw error for zero duration');
}

// Test depend method
try {
    taskGraph.depend('task1', 'task2');
    console.assert(true, 'Should allow valid dependency');
} catch (e) {
    console.assert(false, 'Should not throw error for valid dependency');
}

// This should throw an error because it would create a cycle
try {
    taskGraph.depend('task2', 'task1');
    console.assert(false, 'Should have thrown an error for creating a cycle');
} catch (e) {
    console.assert(e.message.includes('cycle'), 'Should throw error for creating a cycle');
}

// Test error for unknown task dependency
try {
    taskGraph.depend('task1', 'unknown');
    console.assert(false, 'Should have thrown an error for unknown dependency task');
} catch (e) {
    console.assert(e.message.includes('does not exist'), 'Should throw error for unknown dependency task');
}

try {
    taskGraph.depend('unknown', 'task1');
    console.assert(false, 'Should have thrown an error for unknown task');
} catch (e) {
    console.assert(e.message.includes('does not exist'), 'Should throw error for unknown task');
}

// Test error for self-dependency
try {
    taskGraph.depend('task1', 'task1');
    console.assert(false, 'Should have thrown an error for self-dependency');
} catch (e) {
    console.assert(e.message.includes('cannot depend on itself'), 'Should throw error for self-dependency');
}

// Test order method
const testGraph = new TaskGraph();
testGraph.add('task1', 10)
        .add('task2', 20)
        .add('task3', 15)
        .add('task4', 5)
        .depend('task2', 'task1')
        .depend('task3', 'task1')
        .depend('task4', 'task2');

const ordered = testGraph.order();
console.assert(ordered.length === 4, 'Should have 4 tasks in order');
console.assert(ordered.indexOf('task1') < ordered.indexOf('task2'), 'task1 should come before task2');
console.assert(ordered.indexOf('task1') < ordered.indexOf('task3'), 'task1 should come before task3');
console.assert(ordered.indexOf('task2') < ordered.indexOf('task4'), 'task2 should come before task4');

console.log('All asserts passed!');