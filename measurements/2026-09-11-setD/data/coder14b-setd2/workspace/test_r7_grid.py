import unittest
from r7_grid import count_regions

class TestGrid(unittest.TestCase):
    def test_count_regions(self):
        grid1 = [
            ['.', '.', '#', '#'],
            ['#', '.', '.', '#'],
            ['#', '#', '.', '.'],
            ['#', '.', '#', '.']
        ]
        self.assertEqual(count_regions(grid1), 2)

        grid2 = [
            ['.', '.', '.', '.'],
            ['#', '#', '#', '#'],
            ['#', '.', '.', '#'],
            ['#', '#', '#', '#']
        ]
        self.assertEqual(count_regions(grid2), 1)

        grid3 = [
            ['#', '#', '#', '#'],
            ['#', '.', '.', '#'],
            ['#', '#', '#', '#'],
            ['#', '#', '#', '#']
        ]
        self.assertEqual(count_regions(grid3), 1)

        grid4 = [
            ['.', '.', '.', '.'],
            ['.', '.', '.', '.'],
            ['.', '.', '.', '.'],
            ['.', '.', '.', '.']
        ]
        self.assertEqual(count_regions(grid4), 1)

        grid5 = [
            ['#', '#', '#', '#'],
            ['#', '.', '.', '#'],
            ['#', '#', '#', '#'],
            ['#', '#', '#', '#']
        ]
        self.assertEqual(count_regions(grid5), 1)

if __name__ == '__main__':
    unittest.main()
