import unittest
from r6_days import next_weekday
import datetime

class TestR6Days(unittest.TestCase):
    def test_next_weekday(self):
        s = datetime.date(2023, 10, 16)  # Monday
        self.assertEqual(next_weekday(s, 'Tuesday'), datetime.date(2023, 10, 17))
        self.assertEqual(next_weekday(s, 'Wednesday'), datetime.date(2023, 10, 18))
        self.assertEqual(next_weekday(s, 'Thursday'), datetime.date(2023, 10, 19))
        self.assertEqual(next_weekday(s, 'Friday'), datetime.date(2023, 10, 20))
        self.assertEqual(next_weekday(s, 'Saturday'), datetime.date(2023, 10, 21))
        self.assertEqual(next_weekday(s, 'Sunday'), datetime.date(2023, 10, 22))
        self.assertEqual(next_weekday(s, 'Monday'), datetime.date(2023, 10, 23))

        s = datetime.date(2023, 10, 20)  # Friday
        self.assertEqual(next_weekday(s, 'Saturday'), datetime.date(2023, 10, 21))
        self.assertEqual(next_weekday(s, 'Sunday'), datetime.date(2023, 10, 22))
        self.assertEqual(next_weekday(s, 'Monday'), datetime.date(2023, 10, 23))
        self.assertEqual(next_weekday(s, 'Tuesday'), datetime.date(2023, 10, 24))
        self.assertEqual(next_weekday(s, 'Wednesday'), datetime.date(2023, 10, 25))
        self.assertEqual(next_weekday(s, 'Thursday'), datetime.date(2023, 10, 26))
        self.assertEqual(next_weekday(s, 'Friday'), datetime.date(2023, 10, 27))

        with self.assertRaises(ValueError):
            next_weekday(s, 'Weekday')
