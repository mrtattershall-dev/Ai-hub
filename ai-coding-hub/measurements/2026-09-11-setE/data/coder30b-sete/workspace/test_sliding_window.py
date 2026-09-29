import time
from q5_limits import SlidingWindow

# Test the SlidingWindow class
def test_sliding_window():
    # Create a sliding window that allows 3 calls per 2 seconds
    window = SlidingWindow(3, 2)
    
    # First 3 calls should be allowed
    assert window.allow() == True
    assert window.allow() == True
    assert window.allow() == True
    
    # 4th call should be denied
    assert window.allow() == False
    
    # Wait for 1 second, should still be denied (still within window)
    time.sleep(1)
    assert window.allow() == False
    
    # Wait for another second (total 2 seconds), should allow a call
    time.sleep(1)
    assert window.allow() == True
    
    # Now we should be able to make 2 more calls
    assert window.allow() == True
    assert window.allow() == True
    
    # 4th call should be denied again
    assert window.allow() == False
    
    print("All SlidingWindow tests passed!")

if __name__ == "__main__":
    test_sliding_window()