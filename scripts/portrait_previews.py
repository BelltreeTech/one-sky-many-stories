"""Generate the small, uncropped fallback for each published portrait."""
import json
from pathlib import Path

from PIL import Image


def main():
    root = Path(__file__).resolve().parents[1]
    portraits = root / "public" / "portrait"
    previews = portraits / "preview"
    previews.mkdir(exist_ok=True)
    story = json.loads((root / "src/data/story.json").read_text(encoding="utf-8"))
    for scene in story["scenes"]:
        name = f"{scene['id']:02d}.webp"
        target = previews / name
        temporary = target.with_suffix(".tmp")
        with Image.open(portraits / name) as original:
            width = min(360, original.width)
            height = round(original.height * width / original.width)
            preview = original.resize((width, height), Image.Resampling.LANCZOS)
            preview.save(temporary, "WEBP", quality=82, method=6)
        temporary.replace(target)


if __name__ == "__main__":
    main()

