import time
from q5_limits import SlidingWindow

def test_sliding_window():
    window = SlidingWindow(limit=3, window_sec=2)
    assert window.allow() == True
    assert window.allow() == True
    assert window.allow() == True
    assert window.allow() == False
    time.sleep(1)
    assert window.allow() == True
    assert window.allow() == False
    time.sleep(1)
    assert window.allow() == True
    assert window.allow() == False

    print("All tests passed!")

if __name__ == "__main__":
    test_sliding_window()