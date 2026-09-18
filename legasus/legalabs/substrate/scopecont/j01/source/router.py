class Router:
    def __init__(self):
        self._routes = {}

    def add(self, path, handler):
        self._routes[path] = handler

    def resolve(self, path):
        if path in self._routes:
            return self._routes[path]
        return None
