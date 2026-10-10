# /// script
# requires-python = ">=3.12"
# dependencies = ["resvg-py==0.5.0", "pillow==12.3.0"]
# ///
"""Make every app icon from the cartoon logo mark, frontend/public/brand/junksnap-mark.svg.

Writes the web icons (favicon.svg with a dark-mode tile, favicon.ico with 16 and 32 px, the
apple-touch icon, the manifest icons 192 and 512 and the maskable 512) and the Android sources
apps/android-tauri/app-icon.svg (legacy and round launchers) and app-icon-fg.svg (adaptive
foreground). Small sizes drop the fine details (paper creases, then flash and dot) so the mark
stays crisp. Then regenerate the Android launcher set with:
    cd apps/android-tauri; npx tauri icon app-icon.json
Run with: uv run scripts/make_icons.py
"""

import io
import re
import struct
from dataclasses import dataclass
from pathlib import Path

import resvg_py
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MARK = ROOT / "frontend" / "public" / "brand" / "junksnap-mark.svg"
PUBLIC = ROOT / "frontend" / "public"
ANDROID = ROOT / "apps" / "android-tauri"

TEAL = "#0b7a73"
DARK_TILE = "#1f1b16"
CANVAS = 120
# The mark's drawn extent in its 120 grid, strokes included: x, y, width, height.
MARK_BOX = (6.0, 3.5, 113.5, 105.5)
TILE_RADIUS = 26
DETAIL_FULL, DETAIL_NO_CREASES, DETAIL_BOLD = 0, 1, 2


class MarkArt:
    """The mark's drawing, read from the brand SVG, with fine details removable for small sizes."""

    def __init__(self, source: Path) -> None:
        text = source.read_text(encoding="utf-8")
        body = text[text.index(">", text.index("<svg")) + 1 : text.rindex("</svg>")]
        self._parts = [line.strip() for line in body.splitlines() if line.strip().startswith("<")]
        self._parts = [p for p in self._parts if not p.startswith(("<title", "<!--"))]

    def parts(self, detail: int) -> str:
        """The drawing as SVG elements; higher detail levels drop the finer parts."""
        kept = "".join(p for p in self._parts if not self._dropped(p, detail))
        if detail < DETAIL_BOLD:
            return kept
        # 16 px: outlines half as thick again, so they land on whole pixels instead of blurring.
        return re.sub(r'stroke-width="([\d.]+)"', self._thicker, kept)

    @staticmethod
    def _thicker(match: re.Match[str]) -> str:
        return f'stroke-width="{float(match[1]) * 1.6:g}"'

    @staticmethod
    def _dropped(part: str, detail: int) -> bool:
        creases = 'stroke-width="2.5"' in part
        small = part.startswith('<circle cx="23"') or "M101" in part or 'stroke="none"' in part
        return (detail >= DETAIL_NO_CREASES and creases) or (detail >= DETAIL_BOLD and small)


@dataclass(frozen=True)
class IconLayout:
    """Where the mark sits: its width as a share of the canvas, and the tile behind it."""

    mark_share: float
    tile: str  # "rounded", "square" or "none"
    detail: int = DETAIL_FULL


class IconComposer:
    """Builds the SVG text of one icon: tile plus the mark centred and scaled."""

    def __init__(self, mark: MarkArt) -> None:
        self._mark = mark

    def svg(self, layout: IconLayout, style: str = "") -> str:
        head = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CANVAS} {CANVAS}">'
        body = (
            f'<g transform="{self._transform(layout.mark_share)}" fill="none" stroke="#221c15" '
            f'stroke-linecap="round" stroke-linejoin="round">{self._mark.parts(layout.detail)}</g>'
        )
        return f"{head}{style}{self._tile(layout.tile)}{body}</svg>"

    @staticmethod
    def _transform(share: float) -> str:
        x, y, width, height = MARK_BOX
        scale = share * CANVAS / width
        left = (CANVAS - width * scale) / 2 - x * scale
        top = (CANVAS - height * scale) / 2 - y * scale
        return f"translate({left:.2f} {top:.2f}) scale({scale:.4f})"

    @staticmethod
    def _tile(kind: str) -> str:
        if kind == "none":
            return ""
        radius = TILE_RADIUS if kind == "rounded" else 0
        size = f'width="{CANVAS}" height="{CANVAS}"'
        return f'<rect class="tile" {size} rx="{radius}" fill="{TEAL}"/>'


class Rasterizer:
    """Renders SVG text to a small palette PNG."""

    def png(self, svg: str, size: int) -> bytes:
        raw = bytes(resvg_py.svg_to_bytes(svg_string=svg, width=size, height=size))
        image = Image.open(io.BytesIO(raw)).convert("RGBA")
        out = io.BytesIO()
        image.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(out, "PNG", optimize=True)
        return out.getvalue()


class IcoPacker:
    """Packs PNG images into one .ico file (PNG-compressed entries, Vista and later)."""

    def pack(self, images: dict[int, bytes]) -> bytes:
        header = struct.pack("<HHH", 0, 1, len(images))
        offset = len(header) + 16 * len(images)
        entries, blobs = b"", b""
        for size, data in sorted(images.items()):
            side = size % 256  # 0 means 256 in the ICO directory
            entries += struct.pack("<BBBBHHII", side, side, 0, 0, 1, 32, len(data), offset)
            blobs += data
            offset += len(data)
        return header + entries + blobs


class IconSet:
    """Writes every icon file from the mark."""

    def __init__(self, composer: IconComposer, rasterizer: Rasterizer) -> None:
        self._composer = composer
        self._rasterizer = rasterizer

    def write_web(self) -> None:
        favicon = IconLayout(0.9, "rounded", DETAIL_NO_CREASES)
        dark = f"<style>@media (prefers-color-scheme: dark){{.tile{{fill:{DARK_TILE}}}}}</style>"
        favicon_svg = self._composer.svg(favicon, dark) + "\n"
        (PUBLIC / "favicon.svg").write_text(favicon_svg, encoding="utf-8", newline="\n")
        ico = {
            16: self._png(IconLayout(0.94, "rounded", DETAIL_BOLD), 16),
            32: self._png(favicon, 32),
        }
        (PUBLIC / "favicon.ico").write_bytes(IcoPacker().pack(ico))
        brand = PUBLIC / "brand"
        (brand / "apple-touch-icon.png").write_bytes(self._png(IconLayout(0.8, "square"), 180))
        (brand / "icon-192.png").write_bytes(self._png(IconLayout(0.84, "rounded"), 192))
        (brand / "icon-512.png").write_bytes(self._png(IconLayout(0.84, "rounded"), 512))
        (brand / "icon-maskable-512.png").write_bytes(self._png(IconLayout(0.58, "square"), 512))

    def write_android_sources(self) -> None:
        """SVG sources for `tauri icon`: the legacy icon and the adaptive foreground."""
        launcher = self._composer.svg(IconLayout(0.8, "square"))
        foreground = self._composer.svg(IconLayout(0.48, "none"))
        for name, svg in (("app-icon.svg", launcher), ("app-icon-fg.svg", foreground)):
            sized = svg.replace("<svg ", '<svg width="1024" height="1024" ', 1)
            (ANDROID / name).write_text(sized + "\n", encoding="utf-8", newline="\n")

    def _png(self, layout: IconLayout, size: int) -> bytes:
        return self._rasterizer.png(self._composer.svg(layout), size)


def main() -> None:
    icons = IconSet(IconComposer(MarkArt(MARK)), Rasterizer())
    icons.write_web()
    icons.write_android_sources()
    print("wrote the web icons and Android sources; next: cd apps/android-tauri; "
          "npx tauri icon app-icon.json")


if __name__ == "__main__":
    main()
