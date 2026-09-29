import unittest
from s8_grades import Gradebook

class TestGradebook(unittest.TestCase):
    def setUp(self):
        self.gradebook = Gradebook()
        self.gradebook.add_student("Alice")
        self.gradebook.add_assignment("Math", 100)
        self.gradebook.add_assignment("Science", 100)
        self.gradebook.record("Alice", "Math", 85)
        self.gradebook.record("Alice", "Science", 95)

    def test_percent(self):
        self.assertAlmostEqual(self.gradebook.percent("Alice"), 90.00)
        self.gradebook.record("Alice", "Math", 0)
        self.assertAlmostEqual(self.gradebook.percent("Alice"), 47.50)
        self.gradebook.record("Alice", "Science", 0)
        self.assertIsNone(self.gradebook.percent("Alice"))
        with self.assertRaises(KeyError):
            self.gradebook.percent("Bob")

if __name__ == '__main__':
    unittest.main()
