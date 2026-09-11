# Reference solution (final state of chain s8) - used only to prove checks-F.mjs can pass.
import csv
import statistics
import sys


def _is_num(x):
    return not isinstance(x, bool) and isinstance(x, (int, float))


def _num(x):
    return str(int(x)) if float(x).is_integer() else str(x)


def letter(percent):
    if percent is None:
        return "-"
    if percent >= 90:
        return "A"
    if percent >= 80:
        return "B"
    if percent >= 70:
        return "C"
    if percent >= 60:
        return "D"
    return "F"


class Gradebook:
    def __init__(self):
        self._students = []
        self._assign = {}          # name -> {"max": m, "cat": c}, in the order added
        self._scores = {}          # (student, assignment) -> points
        self._weights = {}
        self._drops = {}
        self._missing_zero = False

    def add_student(self, name):
        if name in self._students:
            raise ValueError("student exists: %s" % name)
        self._students.append(name)

    def add_assignment(self, name, max_points, category="default"):
        if name in self._assign:
            raise ValueError("assignment exists: %s" % name)
        if not _is_num(max_points) or not max_points > 0:
            raise ValueError("max_points must be a positive number")
        self._assign[name] = {"max": max_points, "cat": category}

    def record(self, student, assignment, points):
        if student not in self._students:
            raise KeyError(student)
        if assignment not in self._assign:
            raise KeyError(assignment)
        if not _is_num(points) or not 0 <= points <= self._assign[assignment]["max"]:
            raise ValueError("points out of range")
        self._scores[(student, assignment)] = points

    def score(self, student, assignment):
        return self._scores.get((student, assignment))

    def set_weight(self, category, weight):
        if not _is_num(weight) or not weight > 0:
            raise ValueError("weight must be a positive number")
        self._weights[category] = weight

    def drop_lowest(self, category, n):
        self._drops[category] = n

    def set_missing_zero(self, flag):
        self._missing_zero = bool(flag)

    def percent(self, student):
        if student not in self._students:
            raise KeyError(student)
        cats = {}
        for a, info in self._assign.items():
            p = self._scores.get((student, a))
            if p is None:
                if not self._missing_zero:
                    continue
                p = 0
            cats.setdefault(info["cat"], []).append((p, info["max"]))
        if not cats:
            return None
        total_w = acc = 0
        for cat, items in cats.items():
            n = self._drops.get(cat, 0)
            if n and len(items) > n:
                items = sorted(items, key=lambda pm: pm[0] / pm[1])[n:]
            pct = sum(p for p, _ in items) / sum(m for _, m in items) * 100
            w = self._weights.get(cat, 1)
            total_w += w
            acc += w * pct
        return round(acc / total_w, 2)

    def report(self):
        out = []
        for s in sorted(self._students):
            p = self.percent(s)
            out.append((s, p, letter(p)))
        return out

    def curve(self, assignment, points):
        if assignment not in self._assign:
            raise KeyError(assignment)
        mx, changed = self._assign[assignment]["max"], 0
        for key, p in list(self._scores.items()):
            if key[1] == assignment:
                new = min(mx, p + points)
                if new != p:
                    changed += 1
                self._scores[key] = new
        return changed

    def to_csv(self):
        names = list(self._assign)
        lines = [",".join(["student"] + names + ["percent", "letter"])]
        for s, p, l in self.report():
            cells = [s] + ["" if self._scores.get((s, a)) is None else _num(self._scores[(s, a)]) for a in names]
            cells += ["" if p is None else "%.2f" % p, l]
            lines.append(",".join(cells))
        return "\n".join(lines)

    def stats(self, assignment):
        if assignment not in self._assign:
            raise KeyError(assignment)
        pts = [p for (s, a), p in self._scores.items() if a == assignment]
        if not pts:
            raise ValueError("nothing recorded for %s" % assignment)
        return {"count": len(pts), "mean": round(sum(pts) / len(pts), 2), "median": round(statistics.median(pts), 2),
                "min": min(pts), "max": max(pts)}


def main(path):
    g = Gradebook()
    with open(path, encoding="utf-8") as fh:
        for row in csv.reader(fh):
            if not row or not "".join(row).strip():
                continue
            student, assignment = row[0].strip(), row[1].strip()
            points, mx = float(row[2]), float(row[3])
            cat = row[4].strip() if len(row) > 4 and row[4].strip() else "default"
            if student not in g._students:
                g.add_student(student)
            if assignment not in g._assign:
                g.add_assignment(assignment, mx, cat)
            g.record(student, assignment, points)
    print(g.to_csv())


if __name__ == "__main__":
    if len(sys.argv) > 1:
        main(sys.argv[1])
    else:
        g = Gradebook()
        g.add_student("ann")
        g.add_assignment("hw1", 10)
        g.record("ann", "hw1", 9)
        assert g.percent("ann") == 90.0 and letter(90.0) == "A"
