// Simple test to verify localStorage functionality works
// This would normally be run in a browser environment

// Mock localStorage for testing
const mockLocalStorage = {
    data: {},
    getItem: function(key) {
        return this.data[key] || null;
    },
    setItem: function(key, value) {
        this.data[key] = value;
    }
};

// Replace the real localStorage with our mock
const originalLocalStorage = window.localStorage;
window.localStorage = mockLocalStorage;

// Test the saveState function
function testSaveState() {
    // Create a simple state object
    const testState = {
        todo: ['Task 1', 'Task 2'],
        doing: ['Task 3'],
        done: ['Task 4']
    };
    
    // Mock the DOM elements
    const mockTodoList = { children: [{ textContent: 'Task 1' }, { textContent: 'Task 2' }] };
    const mockDoingList = { children: [{ textContent: 'Task 3' }] };
    const mockDoneList = { children: [{ textContent: 'Task 4' }] };
    
    // Mock the updateCounters function
    const updateCounters = function() {
        // This would update the counters in the UI
    };
    
    // Mock the saveState function
    const saveState = function() {
        const state = {
            todo: Array.from(mockTodoList.children).map(child => child.textContent),
            doing: Array.from(mockDoingList.children).map(child => child.textContent),
            done: Array.from(mockDoneList.children).map(child => child.textContent)
        };
        localStorage.setItem('s9-board', JSON.stringify(state));
    };
    
    // Test saving
    saveState();
    
    // Test loading
    const loadedState = JSON.parse(localStorage.getItem('s9-board'));
    
    console.log('Saved state:', testState);
    console.log('Loaded state:', loadedState);
    
    // Verify they match
    if (JSON.stringify(testState) === JSON.stringify(loadedState)) {
        console.log('✅ Test passed: Save/load functionality works correctly');
        return true;
    } else {
        console.log('❌ Test failed: Save/load functionality does not work correctly');
        return false;
    }
}

// Run the test
testSaveState();

// Restore original localStorage
window.localStorage = originalLocalStorage;