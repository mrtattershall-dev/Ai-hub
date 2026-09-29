import subprocess
import unittest

class TestR2Text(unittest.TestCase):
    def test_word_count(self):
        # Create a temporary test file
        with open('test_file.txt', 'w') as file:
            file.write("hello world hello hello world")

        # Run the command-line tool
        result = subprocess.run(['python', 'r2_text.py', 'test_file.txt', '2'], capture_output=True, text=True)

        # Check the output
        expected_output = "hello 3\nworld 2\n"
        self.assertEqual(result.stdout, expected_output)

        # Clean up the temporary test file
        import os
        os.remove('test_file.txt')

if __name__ == '__main__':
    unittest.main()