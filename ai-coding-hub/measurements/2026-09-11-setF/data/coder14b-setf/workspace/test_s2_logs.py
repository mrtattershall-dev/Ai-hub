import unittest
from s2_logs import parse_line

class TestS2Logs(unittest.TestCase):
    def test_parse_line_with_seconds(self):
        line = "2023-10-01 12:34:56,GET,/path,200"
        expected = {
            'timestamp': "2023-10-01 12:34:56",
            'method': "GET",
            'path': "/path",
            'status': 200
        }
        self.assertEqual(parse_line(line), expected)

    def test_parse_line_without_seconds(self):
        line = "2023-10-01 12:34:56,GET,/path"
        expected = {
            'timestamp': "2023-10-01 12:34:56",
            'method': "GET",
            'path': "/path",
            'status': None
        }
        self.assertEqual(parse_line(line), expected)

    def test_parse_line_with_ipv6(self):
        line = "2023-10-01 12:34:56,GET,::1,200"
        expected = {
            'timestamp': "2023-10-01 12:34:56",
            'method': "GET",
            'path': "::1",
            'status': 200
        }
        self.assertEqual(parse_line(line), expected)

    def test_parse_line_invalid(self):
        line = "2023-10-01 12:34:56,GET,/path,200,extra"
        self.assertIsNone(parse_line(line))

if __name__ == '__main__':
    unittest.main()