"""Exercise the real .htaccess files with isolated Apache fixtures, no PHP/DB."""
import argparse
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parents[1]


def request(port, path, host=None):
    headers = {"Host": host} if host else {}
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", headers=headers)
    # Inspect redirects without following them to a real production host.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args):
            return None
    try:
        response = urllib.request.build_opener(NoRedirect).open(req, timeout=3)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, response.read().decode(), response.headers


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apache-root", default="D:/xampp/apache")
    args = parser.parse_args()
    apache = Path(args.apache_root).resolve()
    executable = apache / "bin" / ("httpd.exe" if os.name == "nt" else "httpd")
    assert executable.is_file(), f"Apache not found: {executable}"
    with tempfile.TemporaryDirectory(prefix="mkpos-routing-") as directory:
        fixture = Path(directory).resolve()
        assert fixture.is_relative_to(Path(tempfile.gettempdir()).resolve())
        assert fixture.name.startswith("mkpos-routing-")
        project = fixture / "site"
        public = project / "public"
        public.mkdir(parents=True)
        shutil.copyfile(ROOT / "laravel/.htaccess", project / ".htaccess")
        shutil.copyfile(ROOT / "laravel/public/.htaccess", public / ".htaccess")
        # PHP is intentionally not loaded: the front controller is just a marker.
        (public / "index.php").write_text("PUBLIC_FRONT_CONTROLLER")
        for relative in ["landing/site.css", ".well-known/acme-challenge/probe"]:
            target = public / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("PUBLIC_ASSET")
        (public / ".env").write_text("PRIVATE_FIXTURE")
        for relative in [".env", "composer.json", "vendor/autoload.php", "config/app.php",
                         "storage/logs/laravel.log", "app/Http/Kernel.php", "private-backup.zip"]:
            target = project / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("PRIVATE_FIXTURE")
        (public / "app").mkdir()
        (public / "app/index.html").write_text("PUBLIC_APP")
        shutil.copyfile(ROOT / "frontend/public/.htaccess", public / "app/.htaccess")
        results = []
        for layout, docroot in [("project-root", project), ("public-root", public)]:
            with socket.socket() as sock:
                sock.bind(("127.0.0.1", 0))
                port = sock.getsockname()[1]
            modules = ["authz_core", "dir", "mime", "rewrite"]
            config = fixture / f"{layout}.conf"
            error_log = fixture / f"{layout}-error.log"
            config.write_text("\n".join([
                f'ServerRoot "{apache.as_posix()}"',
                f'Listen 127.0.0.1:{port}',
                f'ServerName 127.0.0.1:{port}',
                f'PidFile "{(fixture / (layout + ".pid")).as_posix()}"',
                f'ErrorLog "{error_log.as_posix()}"',
                *[f'LoadModule {name}_module modules/mod_{name}.so' for name in modules],
                f'TypesConfig "{(apache / "conf/mime.types").as_posix()}"',
                'DirectoryIndex index.php index.html',
                f'DocumentRoot "{docroot.as_posix()}"',
                '<Directory />', 'AllowOverride None', 'Require all denied', '</Directory>',
                f'<Directory "{project.as_posix()}">',
                'AllowOverride All', 'Require all granted', '</Directory>',
            ]))
            process = subprocess.Popen([str(executable), "-f", str(config), "-X"],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                       creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            try:
                for attempt in range(40):
                    assert process.poll() is None, error_log.read_text(errors="replace")
                    try:
                        request(port, "/")
                        break
                    except (OSError, urllib.error.URLError):
                        time.sleep(.1)
                for path in ["/", "/index.php", "/documentation", "/plans", "/api/health"]:
                    status, body, _ = request(port, path)
                    assert (status, body) == (200, "PUBLIC_FRONT_CONTROLLER"), (layout, path, status, body)
                for path in ["/landing/site.css", "/.well-known/acme-challenge/probe"]:
                    status, body, _ = request(port, path)
                    assert (status, body) == (200, "PUBLIC_ASSET"), (layout, path, status)
                for path in ["/.env", "/composer.json", "/vendor/autoload.php", "/config/app.php",
                             "/storage/logs/laravel.log", "/app/Http/Kernel.php", "/private-backup.zip"]:
                    status, body, _ = request(port, path)
                    assert status in [403, 404, 200] and "PRIVATE_FIXTURE" not in body, (layout, path, status)
                    if layout == "project-root" and path not in ["/app/Http/Kernel.php", "/private-backup.zip"]:
                        assert status == 403, (path, status)
                if layout == "project-root":
                    status, body, _ = request(port, "/public/")
                    assert (status, body) == (200, "PUBLIC_FRONT_CONTROLLER")
                    assert request(port, "/public/.env")[0] == 403
                for legacy, host in [("app", "pos"), ("mobile", "mobilepos"), ("office", "office")]:
                    status, _, headers = request(port, f"/{legacy}/login", "pwarmyar.com")
                    assert status == 302 and headers["Location"] == f"https://{host}.pwarmyar.com/login", (status, dict(headers))
                results.append({"layout": layout, "landing_and_routes": "passed", "assets": "passed",
                                "private_files": "protected", "legacy_redirect": "passed"})
            finally:
                process.terminate()
                process.wait(timeout=10)
        print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
