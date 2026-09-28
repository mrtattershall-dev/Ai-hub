import report
assert report.valid_formats(["json", "csv"])
assert not report.valid_formats(["xml"])
assert report.label("csv") == "comma separated", report.label("csv")
assert report.resolve_alias("comma") == "csv", report.resolve_alias("comma")
assert report.dump("csv", [["a", "b"], ["c", "d"]]) == "a,b" + chr(10) + "c,d", report.dump("csv", [["a", "b"], ["c", "d"]])
assert report.dump("xml", []) == ""
print("OK")
