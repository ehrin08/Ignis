"""Generate platform exports from the approved Ignis ember-clerk artwork."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "assets" / "images"
MASTER = IMAGES / "mascot-icon.png"
PAPER = "#EAE8E1"


def master(size: int) -> Image.Image:
    return Image.open(MASTER).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)


def save(image: Image.Image, destination: Path) -> None:
    temporary = destination.with_suffix(".tmp.png")
    image.save(temporary)
    temporary.replace(destination)


def remove_paper(image: Image.Image) -> Image.Image:
    pixels = image.load()
    # The approved master has a warm-paper matte that is subtly lighter than
    # the app token. Sample it from the untouched top centre before removing it.
    paper = image.getpixel((image.width // 2, 4))[:3]
    removed = 0
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha and max(abs(red - paper[0]), abs(green - paper[1]), abs(blue - paper[2])) < 65:
                pixels[x, y] = (red, green, blue, 0)
                removed += 1
    return image


def save_full_icon() -> None:
    icon = master(1024)
    save(icon, IMAGES / "icon.png")
    save(icon.resize((48, 48), Image.Resampling.LANCZOS), IMAGES / "favicon.png")


def save_adaptive_foreground() -> None:
    save(remove_paper(master(1024)), IMAGES / "android-icon-foreground.png")


def save_monochrome() -> None:
    alpha = remove_paper(master(1024)).getchannel("A")
    icon = Image.new("RGBA", alpha.size, (0, 0, 0, 0))
    icon.putalpha(alpha)
    save(icon, IMAGES / "android-icon-monochrome.png")


def save_background() -> None:
    save(Image.new("RGBA", (1024, 1024), PAPER), IMAGES / "android-icon-background.png")


def save_splash() -> None:
    icon = remove_paper(master(512))
    save(icon, IMAGES / "splash-icon.png")


if __name__ == "__main__":
    save_full_icon()
    save_adaptive_foreground()
    save_monochrome()
    save_background()
    save_splash()
