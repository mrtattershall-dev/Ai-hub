"""Tiny dev helper: receives canvas screenshots from the game page via POST."""
import base64
import http.server
import os

OUT = os.path.join(os.path.dirname(__file__), 'shots')
os.makedirs(OUT, exist_ok=True)


class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(n).decode()
        name = self.path.strip('/').replace('.', '_') or 'shot'
        data = body.split(',', 1)[1] if ',' in body else body
        with open(os.path.join(OUT, name + '.png'), 'wb') as f:
            f.write(base64.b64decode(data))
        self.send_response(200)
        self._cors()
        self.end_headers()
        self.wfile.write(b'ok')


http.server.HTTPServer(('127.0.0.1', 8333), H).serve_forever()
