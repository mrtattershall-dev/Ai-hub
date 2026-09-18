import report
assert report.title("  ab ") == "AB", report.title("  ab ")
assert report.plain("  ab ") == "ab"
print("OK")
