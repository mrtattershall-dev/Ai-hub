from s2_logs import percentile, parse_log

def test_percentile():
    # Test with simple case
    entries = [
        {'seconds': 1.0},
        {'seconds': 2.0},
        {'seconds': 3.0},
        {'seconds': 4.0},
        {'seconds': 5.0}
    ]
    
    # 50th percentile (median) should be 3.0
    assert percentile(entries, 50) == 3.0
    
    # 25th percentile should be 2.0
    assert percentile(entries, 25) == 2.0
    
    # 75th percentile should be 4.0
    assert percentile(entries, 75) == 4.0
    
    # 100th percentile should be 5.0
    assert percentile(entries, 100) == 5.0
    
    # 1st percentile should be 1.0
    assert percentile(entries, 1) == 1.0
    
    # Test with duplicate values
    entries2 = [
        {'seconds': 1.0},
        {'seconds': 1.0},
        {'seconds': 2.0},
        {'seconds': 2.0},
        {'seconds': 3.0}
    ]
    
    # 50th percentile should be 2.0
    assert percentile(entries2, 50) == 2.0
    
    # Test with larger dataset
    entries3 = [
        {'seconds': 0.1},
        {'seconds': 0.2},
        {'seconds': 0.3},
        {'seconds': 0.4},
        {'seconds': 0.5},
        {'seconds': 0.6},
        {'seconds': 0.7},
        {'seconds': 0.8},
        {'seconds': 0.9},
        {'seconds': 1.0}
    ]
    
    # 50th percentile should be 0.5
    assert percentile(entries3, 50) == 0.5
    
    # 90th percentile should be 0.9
    assert percentile(entries3, 90) == 0.9
    
    # Test error conditions
    try:
        percentile([], 50)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    try:
        percentile(entries, 0)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    try:
        percentile(entries, 101)
        assert False, "Should have raised ValueError"
    except ValueError:
        pass  # Expected
    
    print("All percentile tests passed!")

if __name__ == "__main__":
    test_percentile()