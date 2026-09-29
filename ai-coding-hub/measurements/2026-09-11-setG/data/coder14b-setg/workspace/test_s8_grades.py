import unittest
from s8_grades import Gradebook

class TestGradebook(unittest.TestCase):
    def setUp(self):
        self.gradebook = Gradebook()
        self.gradebook.add_student("Alice")
        self.gradebook.add_assignment("homework", 100)
        self.gradebook.add_assignment("homework", 100)
        self.gradebook.add_assignment("homework", 100)
        self.gradebook.record("Alice", "homework", 80)
        self.gradebook.record("Alice", "homework", 90)
        self.gradebook.record("Alice", "homework", 70)

    def test_drop_lowest(self):
        self.gradebook.drop_lowest("homework", 1)
        scores = self.gradebook.students["Alice"]
        self.assertEqual(len(scores), 2)
        self.assertIn("homework", scores)
        self.assertIn("homework", scores)
        self.assertNotIn("homework", scores)

    def test_percent(self):
        self.gradebook.drop_lowest("homework", 1)
        percentage = self.gradebook.percent("Alice")
        self.assertAlmostEqual(percentage, 85.0, places=2)

if __name__ == "__main__":
    unittest.main()