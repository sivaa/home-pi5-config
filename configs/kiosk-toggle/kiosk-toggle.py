#!/usr/bin/env python3
"""
Kiosk Toggle Overlay
====================
A floating button using GTK4 + layer-shell that toggles kiosk mode.
Completely independent of the browser.

Toggle Logic:
- If fullscreen: kill browser, clear session, restart (exits fullscreen)
- If not fullscreen: use wlrctl to fullscreen
"""
import gi
import subprocess
import os
import time

gi.require_version('Gtk', '4.0')
gi.require_version('Gtk4LayerShell', '1.0')
from gi.repository import Gtk, Gtk4LayerShell, Gdk


class KioskToggle(Gtk.Application):
    def __init__(self):
        super().__init__(application_id='com.pi.kiosk-toggle')
        self.env = os.environ.copy()
        self.env['WAYLAND_DISPLAY'] = 'wayland-0'
        self.env['XDG_RUNTIME_DIR'] = '/run/user/1000'

    def do_activate(self):
        # Create window
        win = Gtk.Window(application=self)
        win.set_decorated(False)

        # Configure as layer-shell overlay
        Gtk4LayerShell.init_for_window(win)
        Gtk4LayerShell.set_layer(win, Gtk4LayerShell.Layer.OVERLAY)
        Gtk4LayerShell.set_anchor(win, Gtk4LayerShell.Edge.LEFT, True)
        Gtk4LayerShell.set_anchor(win, Gtk4LayerShell.Edge.BOTTOM, True)
        Gtk4LayerShell.set_margin(win, Gtk4LayerShell.Edge.LEFT, 20)
        Gtk4LayerShell.set_margin(win, Gtk4LayerShell.Edge.BOTTOM, 20)

        # Create button
        self.btn = Gtk.Button(label="\u26F6")  # Unicode fullscreen symbol
        self.btn.set_size_request(48, 48)
        self.btn.connect('clicked', self.toggle_kiosk)
        self.btn.add_css_class('kiosk-btn')

        # Apply CSS styling
        css = Gtk.CssProvider()
        css.load_from_data(b'''
            .kiosk-btn {
                background: rgba(0, 0, 0, 0.6);
                color: white;
                font-size: 22px;
                border-radius: 24px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                min-width: 48px;
                min-height: 48px;
                padding: 0;
            }
            .kiosk-btn:hover {
                background: rgba(0, 0, 0, 0.8);
                border-color: rgba(255, 255, 255, 0.5);
            }
            .kiosk-btn:active {
                background: rgba(0, 0, 0, 0.9);
            }
        ''')
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            css,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

        win.set_child(self.btn)
        win.present()

    def is_fullscreen(self):
        """Check if any window is currently fullscreen."""
        result = subprocess.run(
            ['wlrctl', 'toplevel', 'find', 'state:fullscreen'],
            env=self.env,
            capture_output=True
        )
        return result.returncode == 0

    def toggle_kiosk(self, btn):
        """Toggle between fullscreen and windowed mode."""
        if self.is_fullscreen():
            print("[kiosk-toggle] Exiting fullscreen via browser restart")
            # Kill browser
            subprocess.run(['pkill', '-f', 'epiphany'], capture_output=True)
            time.sleep(1)

            # Clear session state (removes fullscreen memory)
            session_file = os.path.expanduser('~/.local/share/epiphany/session_state.xml')
            try:
                os.remove(session_file)
            except FileNotFoundError:
                pass

            # Restart browser service
            subprocess.run(['systemctl', '--user', 'start', 'kiosk-browser'], capture_output=True)

            # Wait for browser to start, then focus and maximize it
            time.sleep(8)
            subprocess.run(['wlrctl', 'toplevel', 'focus', 'app_id:org.gnome.Epiphany'],
                          env=self.env, capture_output=True)
            subprocess.run(['wlrctl', 'toplevel', 'maximize', 'app_id:org.gnome.Epiphany'],
                          env=self.env, capture_output=True)
            print("[kiosk-toggle] Browser restarted and maximized")
        else:
            print("[kiosk-toggle] Entering fullscreen via wlrctl")
            subprocess.run(['wlrctl', 'toplevel', 'fullscreen'], env=self.env, capture_output=True)
            print("[kiosk-toggle] Fullscreen activated")


def main():
    print("[kiosk-toggle] Starting overlay...")
    app = KioskToggle()
    app.run(None)


if __name__ == '__main__':
    main()
