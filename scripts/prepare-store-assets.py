from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "build" / "icon.png"
OUTPUT = ROOT / "build" / "appx"
OUTPUT.mkdir(parents=True, exist_ok=True)

source = Image.open(SOURCE).convert("RGBA")

for name, size in {
    "StoreLogo.png": (50, 50),
    "Square150x150Logo.png": (150, 150),
    "Square44x44Logo.png": (44, 44),
    "LargeTile.png": (310, 310),
    "SmallTile.png": (71, 71),
}.items():
    source.resize(size, Image.Resampling.LANCZOS).save(OUTPUT / name)

wide = Image.new("RGBA", (310, 150), (0, 0, 0, 0))
wide_icon = source.resize((150, 150), Image.Resampling.LANCZOS)
wide.alpha_composite(wide_icon, (80, 0))
wide.save(OUTPUT / "Wide310x150Logo.png")

splash = Image.new("RGBA", (620, 300), "#F4F8FF")
splash_icon = source.resize((240, 240), Image.Resampling.LANCZOS)
splash.alpha_composite(splash_icon, (190, 30))
splash.convert("RGB").save(OUTPUT / "SplashScreen.png")

for path in sorted(OUTPUT.glob("*.png")):
    with Image.open(path) as image:
        print(f"{path.name}: {image.width}x{image.height}")
