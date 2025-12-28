#!/usr/bin/env python3
"""
Kiosk Control Service
=====================
HTTP API for controlling the kiosk display mode.

Uses wlrctl for compositor-level window control.
- Enter fullscreen: wlrctl toplevel fullscreen
- Exit fullscreen: Browser restart (clears session state)

Endpoints:
  GET /api/kiosk/toggle  - Toggle fullscreen mode
  GET /api/kiosk/refresh - Refresh the browser
  GET /api/kiosk/status  - Get current fullscreen status
  GET /health            - Health check

Port: 8889 (localhost only)
"""

import subprocess
import os
import json
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 8889


def run_cmd(cmd, timeout=10):
    """Run a command and return (success, output)."""
    env = os.environ.copy()
    env['WAYLAND_DISPLAY'] = 'wayland-0'
    env['XDG_RUNTIME_DIR'] = '/run/user/1000'
    try:
        result = subprocess.run(
            cmd,
            shell=isinstance(cmd, str),
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return result.returncode == 0, result.stdout + result.stderr
    except Exception as e:
        return False, str(e)


def is_fullscreen():
    """Check if any window is currently fullscreen."""
    success, _ = run_cmd(['wlrctl', 'toplevel', 'find', 'state:fullscreen'])
    return success


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
        elif self.path == '/api/kiosk/status':
            self.get_status()
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

    def get_status(self):
        """Get current fullscreen status."""
        fullscreen = is_fullscreen()
        self.send_json(200, {
            'fullscreen': fullscreen
        })

    def toggle_fullscreen(self):
        """Toggle fullscreen using wlrctl + browser restart approach."""
        was_fullscreen = is_fullscreen()

        if was_fullscreen:
            # Exit fullscreen: kill browser, clear session, restart
            print("[kiosk-control] Exiting fullscreen via browser restart")

            # Kill browser
            run_cmd(['pkill', '-f', 'epiphany'])
            time.sleep(1)

            # Clear session state (removes fullscreen memory)
            session_dir = os.path.expanduser('~/.local/share/epiphany')
            for f in ['session_state.xml', 'session_state.xml~']:
                try:
                    os.remove(os.path.join(session_dir, f))
                except FileNotFoundError:
                    pass

            # Restart browser service
            run_cmd(['systemctl', '--user', 'start', 'kiosk-browser'])

            self.send_json(200, {
                'success': True,
                'action': 'exit_fullscreen',
                'fullscreen': False
            })
        else:
            # Enter fullscreen: use wlrctl
            print("[kiosk-control] Entering fullscreen via wlrctl")
            success, _ = run_cmd(['wlrctl', 'toplevel', 'fullscreen'])

            self.send_json(200, {
                'success': success,
                'action': 'enter_fullscreen',
                'fullscreen': success
            })

    def refresh_browser(self):
        """Send F5 to refresh the browser via wtype."""
        success, _ = run_cmd(['wtype', '-k', 'F5'])
        self.send_json(200, {
            'success': success,
            'action': 'refresh'
        })


def main():
    """Start the kiosk control HTTP server."""
    server = HTTPServer(('127.0.0.1', PORT), KioskHandler)
    print(f"[kiosk-control] Service running on http://127.0.0.1:{PORT}")
    print("[kiosk-control] Endpoints: /api/kiosk/toggle, /api/kiosk/refresh, /api/kiosk/status, /health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[kiosk-control] Shutting down...")
        server.shutdown()


if __name__ == '__main__':
    main()
