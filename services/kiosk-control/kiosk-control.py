#!/usr/bin/env python3
"""
Kiosk Control Service
=====================
HTTP API for controlling the kiosk display mode via labwc/wtype.

Endpoints:
  GET /api/kiosk/toggle  - Toggle fullscreen mode (sends F11)
  GET /api/kiosk/refresh - Refresh the browser (sends F5)
  GET /health            - Health check

Port: 8889 (localhost only)
"""

import subprocess
import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 8889


class KioskHandler(BaseHTTPRequestHandler):
    """HTTP request handler for kiosk control actions."""

    def log_message(self, format, *args):
        """Log to stdout for journalctl visibility."""
        print(f"[kiosk-control] {args[0]}")

    def send_json(self, status_code, data):
        """Send JSON response with CORS headers."""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        """Handle GET requests."""
        if self.path == '/api/kiosk/toggle':
            self.toggle_fullscreen()
        elif self.path == '/api/kiosk/refresh':
            self.refresh_browser()
        elif self.path == '/health':
            self.send_json(200, {'status': 'ok'})
        else:
            self.send_error(404, 'Not Found')

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.end_headers()

    def send_key(self, key):
        """Send a key press via wtype."""
        env = os.environ.copy()
        env['WAYLAND_DISPLAY'] = 'wayland-0'
        try:
            result = subprocess.run(
                ['wtype', '-k', key],
                env=env,
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
        except subprocess.TimeoutExpired:
            print(f"[kiosk-control] Timeout sending key: {key}")
            return False
        except FileNotFoundError:
            print("[kiosk-control] wtype not found - install with: sudo apt install wtype")
            return False
        except Exception as e:
            print(f"[kiosk-control] Error sending key: {e}")
            return False

    def toggle_fullscreen(self):
        """Send F11 to labwc to toggle fullscreen."""
        success = self.send_key('F11')
        self.send_json(200, {
            'success': success,
            'action': 'toggle_fullscreen'
        })

    def refresh_browser(self):
        """Send F5 to refresh the browser."""
        success = self.send_key('F5')
        self.send_json(200, {
            'success': success,
            'action': 'refresh'
        })


def main():
    """Start the kiosk control HTTP server."""
    server = HTTPServer(('127.0.0.1', PORT), KioskHandler)
    print(f"[kiosk-control] Service running on http://127.0.0.1:{PORT}")
    print("[kiosk-control] Endpoints: /api/kiosk/toggle, /api/kiosk/refresh, /health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[kiosk-control] Shutting down...")
        server.shutdown()


if __name__ == '__main__':
    main()
