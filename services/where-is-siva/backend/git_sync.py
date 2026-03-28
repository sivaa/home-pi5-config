"""Push data.json to a separate GitHub repo to trigger Vercel redeploy.

The public site repo is cloned to GIT_REPO_PATH on the Pi.
After each Garmin poll, data.json is copied there, committed, and pushed.
Vercel auto-deploys on push.

Called from main.py via asyncio.to_thread() to avoid blocking the event loop.
"""

import shutil
import subprocess
import logging
import os
import threading
from backend.config import DATA_JSON_PATH, GIT_REPO_PATH

logger = logging.getLogger(__name__)

_push_lock = threading.Lock()


def _run(cmd, cwd):
    """Run a git command, return (success, stderr)."""
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        return False, result.stderr.strip()
    return True, ""


def push_data_json():
    """Copy data.json to the public repo and push. Handles diverged branches."""
    if not _push_lock.acquire(blocking=False):
        logger.debug("Git push already in progress, skipping")
        return
    try:
        _push_data_json_inner()
    finally:
        _push_lock.release()


def _push_data_json_inner():
    repo = GIT_REPO_PATH
    target = os.path.join(repo, "data.json")

    if not os.path.isdir(os.path.join(repo, ".git")):
        logger.error("Public repo not found at %s - run: git clone <repo> %s", repo, repo)
        return

    if not os.path.exists(DATA_JSON_PATH):
        logger.debug("No data.json to push yet")
        return

    try:
        shutil.copy2(DATA_JSON_PATH, target)

        # Check if there are actual changes
        result = subprocess.run(
            ["git", "diff", "--quiet", "data.json"],
            cwd=repo, capture_output=True,
        )
        if result.returncode == 0:
            logger.debug("data.json unchanged, skipping push")
            return

        ok, err = _run(["git", "add", "data.json"], repo)
        if not ok:
            logger.error("git add failed: %s", err)
            return

        ok, err = _run(["git", "commit", "-m", "chore: update tracking data"], repo)
        if not ok:
            logger.error("git commit failed: %s", err)
            return

        ok, err = _run(["git", "push"], repo)
        if ok:
            logger.info("Pushed updated data.json to public repo")
            return

        # Push failed - likely diverged (someone pushed vercel.json fix, etc.)
        logger.warning("git push failed (%s), attempting pull --rebase", err)

        ok, err = _run(["git", "pull", "--rebase", "origin", "main"], repo)
        if not ok:
            logger.error("git pull --rebase failed: %s", err)
            # Abort any stuck rebase
            _run(["git", "rebase", "--abort"], repo)
            return

        ok, err = _run(["git", "push"], repo)
        if ok:
            logger.info("Pushed updated data.json after rebase")
        else:
            logger.error("git push still failed after rebase: %s", err)

    except subprocess.TimeoutExpired:
        logger.error("Git operation timed out (60s)")
    except Exception as e:
        logger.error("Git sync error: %s", e)
