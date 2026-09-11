# Reference solution (final state of chain s6) - used only to prove checks-F.mjs can pass.
import heapq


class Graph:
    def __init__(self):
        self._adj = {}

    def add_node(self, n):
        self._adj.setdefault(n, {})

    def add_edge(self, a, b, weight=1):
        if isinstance(weight, bool) or not isinstance(weight, (int, float)) or not weight > 0:
            raise ValueError("weight must be a positive number")
        self.add_node(a)
        self.add_node(b)
        self._adj[a][b] = weight

    def nodes(self):
        return sorted(self._adj)

    def neighbors(self, a):
        return sorted(self._adj[a].items())

    def _need(self, n):
        if n not in self._adj:
            raise KeyError(n)

    def bfs(self, start):
        self._need(start)
        seen, order, queue = {start}, [], [start]
        while queue:
            n = queue.pop(0)
            order.append(n)
            for m in sorted(self._adj[n]):
                if m not in seen:
                    seen.add(m)
                    queue.append(m)
        return order

    def shortest_path(self, a, b):
        self._need(a)
        self._need(b)
        dist, prev, heap, done = {a: 0}, {}, [(0, a)], set()
        while heap:
            d, n = heapq.heappop(heap)
            if n in done:
                continue
            done.add(n)
            if n == b:
                break
            for m, w in self._adj[n].items():
                nd = d + w
                if m not in dist or nd < dist[m]:
                    dist[m] = nd
                    prev[m] = n
                    heapq.heappush(heap, (nd, m))
        if b not in dist:
            return None
        path = [b]
        while path[-1] != a:
            path.append(prev[path[-1]])
        return (dist[b], path[::-1])

    def has_cycle(self):
        color = {}

        def visit(n):
            color[n] = 1
            for m in self._adj[n]:
                c = color.get(m)
                if c == 1:
                    return True
                if c is None and visit(m):
                    return True
            color[n] = 2
            return False

        return any(color.get(n) is None and visit(n) for n in self.nodes())

    def topo_order(self):
        indeg = {n: 0 for n in self._adj}
        for n in self._adj:
            for m in self._adj[n]:
                indeg[m] += 1
        ready = [n for n in indeg if indeg[n] == 0]
        heapq.heapify(ready)
        out = []
        while ready:
            n = heapq.heappop(ready)
            out.append(n)
            for m in self._adj[n]:
                indeg[m] -= 1
                if indeg[m] == 0:
                    heapq.heappush(ready, m)
        if len(out) != len(self._adj):
            raise ValueError("the graph has a cycle")
        return out

    def remove_node(self, n):
        self._need(n)
        del self._adj[n]
        for edges in self._adj.values():
            edges.pop(n, None)

    def reachable(self, a):
        self._need(a)
        seen, stack = set(), list(self._adj[a])
        while stack:
            n = stack.pop()
            if n in seen:
                continue
            seen.add(n)
            stack.extend(self._adj[n])
        return sorted(seen)

    def components(self):
        und = {n: set() for n in self._adj}
        for n in self._adj:
            for m in self._adj[n]:
                und[n].add(m)
                und[m].add(n)
        seen, comps = set(), []
        for n in sorted(und):
            if n in seen:
                continue
            comp, stack = set(), [n]
            while stack:
                x = stack.pop()
                if x in comp:
                    continue
                comp.add(x)
                stack.extend(und[x])
            seen |= comp
            comps.append(sorted(comp))
        return sorted(comps, key=lambda c: c[0])

    def to_dot(self):
        lines = ["digraph {"]
        for a in sorted(self._adj):
            for b in sorted(self._adj[a]):
                lines.append("  %s -> %s [weight=%s];" % (a, b, self._adj[a][b]))
        touched = set()
        for a, edges in self._adj.items():
            if edges:
                touched.add(a)
                touched.update(edges)
        for n in sorted(self._adj):
            if n not in touched:
                lines.append("  %s;" % n)
        lines.append("}")
        return "\n".join(lines)

    @staticmethod
    def from_text(text):
        g = Graph()
        for i, line in enumerate(text.splitlines(), 1):
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            parts = s.split()
            if len(parts) not in (3, 4) or parts[1] != "->":
                raise ValueError("line %d: expected 'a -> b' or 'a -> b W'" % i)
            w = 1
            if len(parts) == 4:
                try:
                    w = float(parts[3])
                    w = int(w) if w == int(w) else w
                    g.add_edge(parts[0], parts[2], w)
                except (ValueError, OverflowError):
                    raise ValueError("line %d: bad weight %r" % (i, parts[3]))
            else:
                g.add_edge(parts[0], parts[2], w)
        return g


if __name__ == "__main__":
    g = Graph()
    g.add_edge("a", "b", 2)
    g.add_edge("b", "c", 3)
    g.add_edge("a", "c", 10)
    assert g.shortest_path("a", "c") == (5, ["a", "b", "c"])
    assert g.topo_order() == ["a", "b", "c"]
    assert not g.has_cycle()
