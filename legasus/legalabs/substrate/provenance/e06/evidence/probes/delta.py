import report
assert report.valid_formats(["tsv"]), "the new format must be admitted"
assert report.label("tsv") == "tab separated", report.label("tsv")
want = "a" + chr(9) + "b" + chr(10) + "c" + chr(9) + "d"
assert report.dump("tsv", [["a", "b"], ["c", "d"]]) == want, report.dump("tsv", [["a", "b"], ["c", "d"]])
assert report.dump("csv", [["a", "b"]]) == "a,b", "existing formats unchanged"
print("OK")
