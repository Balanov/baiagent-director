import hashlib
import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_PUBLISHER = "Баланов Антон Николаевич"
REQUIRED_FILES = {
    "AppxManifest.xml",
    "AppxBlockMap.xml",
    "assets/StoreLogo.png",
    "assets/Square150x150Logo.png",
    "assets/Square44x44Logo.png",
    "assets/Wide310x150Logo.png",
    "assets/SplashScreen.png",
}


def fail(message):
    raise SystemExit(f"Store package validation failed: {message}")


def main():
    if len(sys.argv) != 2:
        fail("pass the .appx path")
    package = Path(sys.argv[1]).resolve()
    if not package.is_file():
        fail(f"file not found: {package}")
    if not zipfile.is_zipfile(package):
        fail("not a valid AppX/ZIP package")

    with package.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    with zipfile.ZipFile(package) as archive:
        corrupt = archive.testzip()
        if corrupt:
            fail(f"corrupt ZIP entry: {corrupt}")
        names = {unquote(name) for name in archive.namelist()}
        missing = sorted(REQUIRED_FILES - names)
        if missing:
            fail(f"missing files: {missing}")
        non_ansi = sorted(name for name in names if not name.isascii())
        if non_ansi:
            fail(f"non-ANSI package paths: {non_ansi[:10]}")
        manifest = ElementTree.fromstring(archive.read("AppxManifest.xml"))

    ns = {"m": "http://schemas.microsoft.com/appx/manifest/foundation/windows10"}
    identity = manifest.find("m:Identity", ns)
    properties = manifest.find("m:Properties", ns)
    if identity is None or properties is None:
        fail("manifest identity or properties are missing")
    publisher_display_name = properties.findtext("m:PublisherDisplayName", namespaces=ns)
    display_name = properties.findtext("m:DisplayName", namespaces=ns)
    if publisher_display_name != EXPECTED_PUBLISHER:
        fail(f"unexpected publisher display name: {publisher_display_name!r}")
    if display_name != "BAIagent Director":
        fail(f"unexpected display name: {display_name!r}")
    application = manifest.find("m:Applications/m:Application", ns)
    executable = application.attrib.get("Executable") if application is not None else None
    if executable != "app\\BAIagent Director.exe":
        fail(f"unexpected executable: {executable!r}")
    if executable.replace("\\", "/") not in names:
        fail(f"executable is missing from package: {executable}")

    project = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    if project["version"].split(".", 1)[0] == "0":
        fail("Microsoft Store requires a non-zero major package version")
    expected_version = project["version"] + ".0"
    if identity.attrib.get("Version") != expected_version:
        fail(f"expected package version {expected_version}, got {identity.attrib.get('Version')}")

    report = {
        "file": str(package),
        "bytes": package.stat().st_size,
        "sha256": digest,
        "identityName": identity.attrib.get("Name"),
        "identityPublisher": identity.attrib.get("Publisher"),
        "version": identity.attrib.get("Version"),
        "publisherDisplayName": publisher_display_name,
        "displayName": display_name,
        "storeSignaturePresent": "AppxSignature.p7x" in names,
        "entries": len(names),
        "zipIntegrity": "ok",
        "ansiPaths": "ok",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
