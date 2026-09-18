import report
assert report.describe("abcdefg") == "ABCDEFG | long", report.describe("abcdefg")
assert report.describe("ab") == "AB | short", report.describe("ab")
assert report.suffix_of("abcdefg") == "long"
assert report.blank("   ")
assert not report.blank(" a ")
assert report.plain(" a ") == "a", "the existing helpers must be unchanged"
print("OK")
