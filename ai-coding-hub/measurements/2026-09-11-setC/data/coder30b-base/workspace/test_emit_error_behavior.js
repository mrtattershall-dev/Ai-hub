const EventBus = require('./s3_events');

// Test the specific behavior: one listener throwing should not stop others
const eventBus = new EventBus();

let firstCalled = false;
let secondCalled = false;
let thirdCalled = false;

// Add listeners where the second one throws an error
eventBus.on('test', () => {
    console.log('First listener called');
    firstCalled = true;
});

eventBus.on('test', () => {
    console.log('Second listener called - about to throw');
    secondCalled = true;
    throw new Error('Second listener error');
});

eventBus.on('test', () => {
    console.log('Third listener called');
    thirdCalled = true;
});

try {
    eventBus.emit('test');
    console.log('ERROR: Should have thrown an exception');
} catch (error) {
    console.log('Caught expected error:', error.message);
    console.log('First listener called:', firstCalled);
    console.log('Second listener called:', secondCalled);
    console.log('Third listener called:', thirdCalled);
    
    // Verify all listeners were called
    if (firstCalled && secondCalled && thirdCalled) {
        console.log('SUCCESS: All listeners were called despite one throwing');
    } else {
        console.log('FAILURE: Not all listeners were called');
    }
}