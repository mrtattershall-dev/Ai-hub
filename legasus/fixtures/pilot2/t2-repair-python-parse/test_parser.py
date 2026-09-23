def test_parse_pairs():
    assert parse_pairs("a=1;b=2;c=3") == {"a": "1", "b": "2", "c": "3"}
    assert parse_pairs("a=1;b=2;c=3;") == {"a": "1", "b": "2", "c": "3"}
    assert parse_pairs("a=1") == {"a": "1"}
    assert parse_pairs("") == {}
    assert parse_pairs("a=1;b=2;c=3;d=4;e=5") == {"a": "1", "b": "2", "c": "3", "d": "4", "e": "5"}
    print("All tests passed!")

test_parse_pairs()