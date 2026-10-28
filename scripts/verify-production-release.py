"""Verify an already packaged PwarMyar release without running or publishing apps."""
import hashlib
import json
from pathlib import Path
import re
import struct
import sys
import zipfile
from datetime import datetime, timezone

version = sys.argv[1]
if not re.fullmatch(r"\d+\.\d+\.\d+", version):
    raise SystemExit("Expected a semantic version")
root = Path(__file__).resolve().parents[1]
release_name = sys.argv[2] if len(sys.argv) > 2 else f"PwarMyar-{version}"
if not re.fullmatch(r"[A-Za-z0-9.-]+", release_name) or release_name in (".", ".."):
    raise SystemExit("Expected a release folder name under release/")
release = root / "release" / release_name
manifest = json.loads((release / "manifest.json").read_text(encoding="utf-8-sig"))
assert len({record["file"] for record in manifest}) == len(manifest), "Duplicate manifest entries"
expected_api = b"https://www.pwarmyar.com/public/api"
web_results = []
for record in manifest:
    file = release / record["file"]
    assert file.parent == release and file.is_file(), record["file"]
    assert file.stat().st_size == record["bytes"]
    with file.open("rb") as handle:
        assert hashlib.file_digest(handle, "sha256").hexdigest() == record["sha256"], file.name
    if file.suffix != ".zip":
        continue
    with zipfile.ZipFile(file) as archive:
        assert archive.testzip() is None, file.name
        for name in archive.namelist():
            assert not name.startswith(("/", "\\")) and ".." not in Path(name).parts, name
            assert not re.search(r"(^|/)(node_modules|vendor|storage|\.git)(/|$)|\.(jks|keystore|sqlite|log)$|upload-key\.properties", name), name
            assert not re.search(r"(^|/)\.env($|\.)", name) or name == ".env.production.example", name
        match = re.fullmatch(r"PwarMyar-(Business|Mobile|Office|Shop)-Web-.*\.zip", file.name)
        if file.name in ("PwarMyar-Laravel-Portfolio-Update.zip", f"PwarMyar-Laravel-Update-{version}.zip"):
            assert "database/seed-data/ai-skills-v1.json" in archive.namelist(), "Agent skill migration seed snapshot missing"
            assert ".htaccess" in archive.namelist() and "public/.htaccess" in archive.namelist(), "Shared-host routing files missing"
            assert "shop/.htaccess" in archive.namelist(), "Laravel shop routing file missing"
            assert archive.read("shop/index.html") == (root / "laravel/shop/index.html").read_bytes(), "Laravel shop build missing or stale"
        if file.name == f"PwarMyar-Realtime-Server-{version}.zip":
            assert len(archive.namelist()) == 11 and "ai-jobs.js" in archive.namelist(), "Incomplete realtime package"
            assert json.loads(archive.read("package.json"))["version"] == version
            assert json.loads(archive.read("package-lock.json"))["packages"][""]["version"] == version
        if match:
            assert ".htaccess" in archive.namelist()
            assert json.loads(archive.read("release.json").decode("utf-8-sig"))["version"] == version
            html = archive.read("index.html").decode()
            assets = re.findall(r'(?:src|href)="(?:\./|/)?(assets/[^"?#]+)', html)
            assert assets and any(asset.endswith(".js") for asset in assets)
            scripts = []
            for asset in assets:
                assert asset in archive.namelist(), asset
                if asset.endswith(".js"):
                    scripts.append(archive.read(asset))
            assert any(expected_api in script for script in scripts), file.name
            if match[1] == "Shop":
                hosting = root / "laravel/shop"
                assert json.loads((hosting / "release.json").read_text(encoding="utf-8-sig"))["version"] == version
                assert archive.read("index.html") == (hosting / "index.html").read_bytes()
                for name in archive.namelist():
                    if name != "release.json":
                        assert archive.read(name) == (hosting / name).read_bytes(), name
            web_results.append({"app": match[1], "entry_assets": len(assets), "files": len(archive.namelist()), "production_api_verified": True})

assert sorted(item["app"] for item in web_results) == ["Business", "Mobile", "Office", "Shop"], "Expected all four web apps"

apk = release / f"PwarMyar-mobile-production-release-{version}.apk"
aab = release / f"PwarMyar-mobile-production-{version}.aab"
with zipfile.ZipFile(apk) as android, zipfile.ZipFile(aab) as bundle:
    assert android.testzip() is None and bundle.testzip() is None
    assert json.loads(android.read("assets/public/release.json"))["version"] == version
    assert json.loads(bundle.read("base/assets/public/release.json"))["version"] == version
    for file in (root / "laravel/public/mobile/assets").glob("*"):
        if file.suffix in (".js", ".css"):
            value = file.read_bytes()
            assert android.read("assets/public/assets/" + file.name) == value, file.name
            assert bundle.read("base/assets/public/assets/" + file.name) == value, file.name

architectures = []
for arch, directory, expected in [("x64", "win-unpacked", 0x8664), ("ia32", "win-ia32-unpacked", 0x14C)]:
    executable = root / "release/electron" / directory / "PwarMyar.exe"
    with executable.open("rb") as handle:
        assert handle.read(2) == b"MZ"
        handle.seek(0x3C)
        offset = struct.unpack("<I", handle.read(4))[0]
        handle.seek(offset)
        assert handle.read(4) == b"PE\0\0"
        assert struct.unpack("<H", handle.read(2))[0] == expected, arch
    architectures.append(arch)

result = {"version": version, "verified_at_utc": datetime.now(timezone.utc).isoformat(),
          "deliverables": len(manifest), "sha256_verified": True, "zip_integrity_verified": True,
          "private_configuration_excluded": True, "web": web_results,
          "android_release_assets_match_current_mobile_build": True,
          "laravel_shop_hosting_verified": True,
          "windows_architectures_verified": architectures,
          "deployment_performed": False, "security_clearance": False,
          "security_review": "artifacts/production-blocker-fixes-2026-10-27.md"}
(release / "verification.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
