import unittest
from r7_grid import life_step

class TestLifeStep(unittest.TestCase):
    def test_life_step(self):
        grid = [
            [False, True, False],
            [True, True, True],
            [False, True, False]
        ]
        expected = [
            [True, True, True],
            [True, True, True],
            [True, True, True]
        ]
        result = life_step(grid)
        self.assertEqual(result, expected)

if __name__ == '__main__':
    unittest.main()