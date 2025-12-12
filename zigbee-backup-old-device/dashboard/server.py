#!/usr/bin/env python3
"""
Simple HTTP server that:
1. Serves static files from the dashboard directory
2. Proxies /api/influx/* requests to InfluxDB with CORS headers
"""

import http.server
import socketserver
import urllib.request
import urllib.parse
import json
from pathlib import Path

PORT = 8888
INFLUX_URL = "http://localhost:8086"

class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to all responses
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # Proxy InfluxDB requests
        if self.path.startswith('/api/influx/'):
            self.proxy_influx()
        else:
            super().do_GET()

    def proxy_influx(self):
        # Extract the InfluxDB path and query
        influx_path = self.path.replace('/api/influx', '')
        target_url = f"{INFLUX_URL}{influx_path}"

        try:
            with urllib.request.urlopen(target_url, timeout=10) as response:
                data = response.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(data)
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

if __name__ == '__main__':
    # Change to the dashboard directory
    import os
    os.chdir(Path(__file__).parent)

    with socketserver.TCPServer(("", PORT), DashboardHandler) as httpd:
        print(f"Dashboard server running at http://localhost:{PORT}")
        print(f"Proxying InfluxDB at {INFLUX_URL}")
        httpd.serve_forever()
