import s2_logs
import json

# Test data
log_data = """
{"timestamp": "2023-10-01T12:00:00", "level": "INFO", "message": "System started"}
{"timestamp": "2023-10-01T12:01:00", "level": "ERROR", "message": "Failed to load resource"}
{"timestamp": "2023-10-01T12:02:00", "level": "WARNING", "message": "Low memory"}
{}
This is a malformed line
{"timestamp": "2023-10-01T12:03:00", "level": "DEBUG", "message": "Debugging"}
"""

def test_parse_log():
    parsed_logs = s2_logs.parse_log(log_data)
    expected_logs = [
        {"timestamp": "2023-10-01T12:00:00", "level": "INFO", "message": "System started"},
        {"timestamp": "2023-10-01T12:01:00", "level": "ERROR", "message": "Failed to load resource"},
        {"timestamp": "2023-10-01T12:02:00", "level": "WARNING", "message": "Low memory"},
        {"timestamp": "2023-10-01T12:03:00", "level": "DEBUG", "message": "Debugging"}
    ]
    assert parsed_logs == expected_logs, f"Expected {expected_logs}, but got {parsed_logs}"

def test_bad_lines():
    malformed_lines = s2_logs.bad_lines(log_data)
    expected_malformed_lines = [4, 5]
    assert malformed_lines == expected_malformed_lines, f"Expected {expected_malformed_lines}, but got {malformed_lines}"

if __name__ == "__main__":
    test_parse_log()
    test_bad_lines()
    print("All tests passed.")