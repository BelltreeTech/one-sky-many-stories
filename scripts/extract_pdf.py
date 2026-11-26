"""Extract this edition's illustrated scenes. Requires Poppler and scripts/requirements.txt."""
import argparse
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
from shutil import copyfile
import subprocess
from tempfile import TemporaryDirectory

from PIL import Image, ImageFilter
import pymupdf


ROOT = Path(__file__).resolve().parents[1]
TITLE = "One Sky, Many Stories"
SOURCE_HASH = "e0f32267d89fa515a7ee29605a0b1174ae3c1d4a4a3ba2dbc8b0eb0ae5fb05aa"
ALT_TEXT = (
    "Luna carries her lantern up a flower-covered hill toward Leo and Noah, who are sitting under the stars.",
    "Leo offers Luna a seat in the grass. Beside him, Noah shifts over as Luna looks up.",
    "Seen from behind, Luna points at a small blue-white star cluster while Leo opens his hand toward it.",
    "Leo holds his blue book and speaks to Luna. An image of her grandmother on a lamplit porch appears in the sky.",
    "On a wooden veranda, a young Luna points above the snowy valley while her grandmother sits beside her.",
    "A court writer in layered robes holds a brush over paper by lamplight, with a winter sky beyond the open window.",
    "Luna counts on her fingers as her grandmother smiles, with a small group of bright stars above the porch.",
    "Leo looks through a brass telescope as Noah steadies it. A round inset shows many more stars.",
    "Leo opens his blue book by lantern light. Seven figures in flowing robes appear in a vision above the three friends.",
    "Seven sisters run past an olive tree over a rocky hillside, their long dresses trailing in the evening light.",
    "Seven women drift upward in pale streams of starlight, with the mountains far below.",
    "Leo rests his hand on his closed book as Luna looks up toward the star cluster and Noah listens.",
    "Noah speaks with his star journal in one hand. A dawn-lit lake and mountains appear beyond him.",
    "Noah kneels beside a winter lake, pointing toward the small star cluster over the brightening horizon.",
    "A luminous mother stretches out her arms above the mountains, with three daughters on each side.",
    "Six luminous daughters reach toward fern shoots, a tree and a river as their mother watches over the valley.",
    "Family members pass a bowl of food around a table. A photograph sits on the mantel, and snow lies outside.",
    "Luna holds a pencil over her open notebook. Leo and Noah lean in to see three small drawings of the stars.",
    "Luna points down the winding path toward the lights of a town. Leo and Noah stand beside her with their books.",
    "Seen from behind, Luna, Leo and Noah sit shoulder to shoulder beside one lantern beneath a vast starry sky.",
)


def poppler_oracle(pdf):
    """Read independently with Poppler; verify page breaks, printed folios and image inventory."""
    result = subprocess.check_output(
        ["pdftotext", "-enc", "UTF-8", "-layout", str(pdf), "-"], encoding="utf-8"
    )
    leaves = result.rstrip("\f\n").split("\f")
    inventory = subprocess.check_output(["pdfimages", "-list", str(pdf)], encoding="utf-8")
    images = [row.split() for row in inventory.splitlines()[2:] if row.strip()]
    if len(leaves) != len(ALT_TEXT) or len(images) != len(leaves):
        raise ValueError("Expected 20 text pages and one embedded image per page")
    scenes = []
    for page_no, (leaf, image) in enumerate(zip(leaves, images), start=1):
        lines = [line.strip() for line in leaf.splitlines() if line.strip()]
        if not lines or lines.pop() != f"{page_no:02}":
            raise ValueError(f"Missing printed folio on page {page_no}")
        if page_no == 1 and (not lines or lines.pop(0) != TITLE):
            raise ValueError("Missing title on first page")
        if not lines or image[0] != str(page_no) or image[2] != "image":
            raise ValueError(f"Invalid text or image on page {page_no}")
        scenes.append(dict(id=page_no, text=" ".join(lines), width=int(image[3]), height=int(image[4])))
    return {"pdfSha256": SOURCE_HASH, "title": TITLE, "scenes": scenes}


def extract_scene(document, page, expected, directory):
    number = expected["id"]
    lines = []
    for block in page.get_text("dict", flags=0, sort=True)["blocks"]:
        for line in block.get("lines", []):
            # Coordinates in PDF points, measured from the top. Title (18 pt) and
            # folio (11 pt) share the ivory panel with the 20–23 pt story.
            body = [span["text"] for span in line["spans"]
                    if span["bbox"][1] >= 405 and 20 <= span["size"] <= 23]
            if body:
                lines.append("".join(body))
    text = " ".join(lines)
    images = page.get_images(full=True)
    if text != expected["text"] or len(images) != 1:
        raise ValueError(f"Body text or image count disagrees with Poppler on page {number}")
    embedded = document.extract_image(images[0][0])
    if embedded["ext"] != "jpeg":
        raise ValueError(f"Expected an embedded JPEG on page {number}")
    original = embedded["image"]
    with Image.open(BytesIO(original)) as art:
        if art.size != (expected["width"], expected["height"]):
            raise ValueError(f"Image dimensions disagree on page {number}")
        art.save(directory / f"{number:02}.webp", "WEBP", quality=87, method=6)
        if number == 1:
            # A single unscaled sample of the painted sky, clear of Luna and the Pleiades.
            sky = art.crop((round(art.width * .32), 0, round(art.width * .60), round(art.height * .15)))
            sky.save(directory / "night-sky.webp", "WEBP", quality=94, method=6)
        # Preserve the colors of the sky and ground for the portrait background.
        # The foreground uses the full illustration above, with its native aspect ratio.
        colors = art.convert("RGB").resize((80, 80), Image.Resampling.BOX)
        colors.filter(ImageFilter.GaussianBlur(7)).save(
            directory / f"{number:02}-atmosphere.webp", "WEBP", quality=76
        )
    (directory / f"{number:02}.jpg").write_bytes(original)
    return {
        **expected, "text": text, "image": f"art/{number:02}.webp",
        "alt": ALT_TEXT[number - 1], "chapter": (number - 1) // 4 + 1,
    }


def save_json(data, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path, help="The unchanged source edition")
    parser.add_argument("--originals-dir", type=Path, help="Store source JPEGs in .private/ or outside the repository")
    args = parser.parse_args()
    if args.originals_dir:
        destination = args.originals_dir.resolve()
        if destination.is_relative_to(ROOT) and not destination.is_relative_to(ROOT / ".private"):
            parser.error("Choose .private/ or a directory outside the web repository for original JPEGs")
    pdf = args.pdf.resolve()
    if sha256(pdf.read_bytes()).hexdigest() != SOURCE_HASH:
        parser.error("PDF does not match the source edition")
    oracle = poppler_oracle(pdf)

    # Publish only after every page agrees between the two extractors.
    with TemporaryDirectory() as temporary, pymupdf.open(pdf) as document:
        staging = Path(temporary)
        if len(document) != len(oracle["scenes"]) or document.metadata["title"] != TITLE:
            raise ValueError("Source metadata disagrees with the approved edition")
        scenes = [extract_scene(document, page, expected, staging)
                  for page, expected in zip(document, oracle["scenes"])]
        art_dir = ROOT / "public/art"
        art_dir.mkdir(parents=True, exist_ok=True)
        atmosphere_dir = ROOT / "public/atmosphere"
        atmosphere_dir.mkdir(parents=True, exist_ok=True)
        copyfile(staging / "night-sky.webp", atmosphere_dir / "night-sky.webp")
        if args.originals_dir:
            args.originals_dir.mkdir(parents=True, exist_ok=True)
        for scene in scenes:
            stem = f'{scene["id"]:02}'
            copyfile(staging / f"{stem}.webp", art_dir / f"{stem}.webp")
            copyfile(staging / f"{stem}-atmosphere.webp", atmosphere_dir / f"{stem}.webp")
            if args.originals_dir:
                copyfile(staging / f"{stem}.jpg", args.originals_dir / f"{stem}.jpg")
        save_json({"title": TITLE, "scenes": scenes}, ROOT / "src/data/story.json")
        save_json(oracle, ROOT / "tests/fixtures/pdf-oracle.json")
    print(f"Extracted and cross-checked {len(scenes)} scenes from {pdf.name}.")


if __name__ == "__main__":
    main()
