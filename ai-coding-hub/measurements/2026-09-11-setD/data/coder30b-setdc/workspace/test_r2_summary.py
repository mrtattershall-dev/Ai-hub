import unittest
import r2_text

class TestSummary(unittest.TestCase):
    
    def test_summary_empty_text(self):
        result = r2_text.summary("")
        expected = {"words": 0, "unique": 0, "sentences": 0, "top": []}
        self.assertEqual(result, expected)
    
    def test_summary_simple_text(self):
        text = "Hello world. Hello everyone!"
        result = r2_text.summary(text)
        # "hello" appears 2 times, "world" and "everyone" appear once each
        # So top 3 should be [("hello", 2), ("everyone", 1), ("world", 1)]
        expected = {"words": 4, "unique": 3, "sentences": 2, "top": [("hello", 2), ("everyone", 1), ("world", 1)]}
        self.assertEqual(result, expected)
    
    def test_summary_complex_text(self):
        text = "The quick brown fox jumps over the lazy dog. The dog was sleeping. Quick brown animals are fast!"
        result = r2_text.summary(text)
        # "the" appears 3 times, "quick" appears 2 times, "brown" appears 2 times
        # "fox", "jumps", "over", "lazy", "dog", "was", "sleeping", "animals", "are", "fast" appear once each
        # Top 3 should be [("the", 3), ("brown", 2), ("dog", 2)]
        expected = {"words": 18, "unique": 13, "sentences": 3, "top": [("the", 3), ("brown", 2), ("dog", 2)]}
        self.assertEqual(result, expected)

if __name__ == '__main__':
    unittest.main()