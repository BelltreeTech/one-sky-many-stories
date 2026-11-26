"""Mount the build at its Pages project path with ordinary static HTTP semantics."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from tempfile import TemporaryDirectory

dist = Path(__file__).resolve().parents[1] / "dist"
if not (dist / "index.html").is_file():
    raise SystemExit("Build the app before running browser tests.")

base = os.getenv("VITE_BASE_PATH", "/one-sky-many-stories/").strip("/")
with TemporaryDirectory() as folder:
    root = Path(folder)
    if base:
        parts = base.split("/")
        if any(part in ("", ".", "..") for part in parts):
            raise SystemExit("Invalid Pages mount path")
        mount = root.joinpath(*parts)
        mount.parent.mkdir(parents=True, exist_ok=True)
        mount.symlink_to(dist, target_is_directory=True)
    else:
        root = dist
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    with ThreadingHTTPServer(("127.0.0.1", 4182), handler) as server:
        server.serve_forever()
