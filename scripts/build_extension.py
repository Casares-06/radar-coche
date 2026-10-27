"""Empaqueta la web estática como extensión Chrome sin dependencias externas."""

from pathlib import Path
import shutil
from zipfile import ZipFile, ZIP_DEFLATED


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "extension-src"
OUTPUT = ROOT / "extension-build"


def main() -> None:
    if OUTPUT.exists():
        resolved = OUTPUT.resolve()
        if resolved.parent != ROOT.resolve():
            raise RuntimeError("La carpeta de salida no está dentro del proyecto.")
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()
    for file in ROOT.iterdir():
        if file.is_file() and file.suffix in {".html", ".css", ".js", ".mjs", ".svg"}:
            shutil.copy2(file, OUTPUT / file.name)
    shutil.copytree(ROOT / "fonts", OUTPUT / "fonts")
    shutil.copytree(SOURCE, OUTPUT, dirs_exist_ok=True)
    archive = ROOT / "radar-coche-extension.zip"
    with ZipFile(archive, "w", ZIP_DEFLATED) as package:
        for file in OUTPUT.rglob("*"):
            if file.is_file():
                package.write(file, file.relative_to(OUTPUT))
    print(OUTPUT)
    print(archive)


if __name__ == "__main__":
    main()
