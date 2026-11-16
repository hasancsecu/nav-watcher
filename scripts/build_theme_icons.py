import os
import base64
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

def build_all():
    icons_dir = "D:/nav-watcher/public/icons"
    public_dir = "D:/nav-watcher/public"
    os.makedirs(icons_dir, exist_ok=True)

    # 1. Load the recolored theme icon
    master_path = "D:/nav-watcher/public/theme_cyan_white_dollar.png"
    master = Image.open(master_path).convert("RGBA")

    # 2. Save icon-512x512.png (transparent)
    path_512 = os.path.join(icons_dir, "icon-512x512.png")
    master.save(path_512, optimize=True)
    print(f"Saved {path_512}")

    # 3. Save icon-192x192.png (transparent)
    path_192 = os.path.join(icons_dir, "icon-192x192.png")
    icon_192 = master.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save(path_192, optimize=True)
    print(f"Saved {path_192}")

    # 4. Save icon-maskable-512x512.png (full-bleed dark background + centered in 80% safe zone)
    maskable_canvas = Image.new("RGBA", (512, 512), (9, 13, 22, 255))
    # Subtle ambient radial glow behind the graphic
    glow = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((80, 80, 432, 432), fill=(51, 198, 228, 40))
    glow = glow.filter(ImageFilter.GaussianBlur(40))
    maskable_canvas = Image.alpha_composite(maskable_canvas, glow)

    scaled_maskable = master.resize((330, 330), Image.Resampling.LANCZOS)
    offset_m = (512 - 330) // 2
    maskable_canvas.paste(scaled_maskable, (offset_m, offset_m), scaled_maskable)

    path_maskable = os.path.join(icons_dir, "icon-maskable-512x512.png")
    maskable_canvas.save(path_maskable, optimize=True)
    print(f"Saved {path_maskable}")

    # 5. Save apple-touch-icon.png (180x180, dark background)
    apple_canvas = Image.new("RGBA", (180, 180), (9, 13, 22, 255))
    apple_icon = master.resize((140, 140), Image.Resampling.LANCZOS)
    apple_canvas.paste(apple_icon, (20, 20), apple_icon)

    path_apple_icons = os.path.join(icons_dir, "apple-touch-icon.png")
    path_apple_root = os.path.join(public_dir, "apple-touch-icon.png")
    apple_canvas.save(path_apple_icons, optimize=True)
    apple_canvas.save(path_apple_root, optimize=True)
    print(f"Saved {path_apple_icons} and {path_apple_root}")

    # 6. Save favicon.ico with 16x16, 32x32, 48x48
    fav16 = master.resize((16, 16), Image.Resampling.LANCZOS)
    fav32 = master.resize((32, 32), Image.Resampling.LANCZOS)
    fav48 = master.resize((48, 48), Image.Resampling.LANCZOS)

    path_favicon = os.path.join(public_dir, "favicon.ico")
    fav32.save(
        path_favicon,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[fav16, fav48]
    )
    print(f"Saved {path_favicon}")

    # 7. Generate vector SVG with embedded high-resolution data URI
    with open(path_512, "rb") as f:
        png_b64 = base64.b64encode(f.read()).decode("utf-8")

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Brand Cyan Palette: #7dd3fc to #33c6e4 to #0284c7 -->
    <linearGradient id="navBrandCyan" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#7dd3fc" />
      <stop offset="50%" stop-color="#33c6e4" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
  </defs>
  <image width="512" height="512" href="data:image/png;base64,{png_b64}" />
</svg>'''

    path_svg = os.path.join(icons_dir, "icon.svg")
    with open(path_svg, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"Saved {path_svg}")

    # 8. Clean up temporary test files
    temp_files = [
        "public/theme_test_transparent.png",
        "public/test_fav_trans32.png",
        "public/test_fav_tile32.png",
        "public/theme_opt1_cyan.png",
        "public/theme_opt2_cyan_emerald.png",
        "public/theme_cyan_white_dollar.png",
        "public/theme_cyan_white_dollar_dark.png",
        "public/test_orig_on_dark.png",
        "public/test_maskable.png",
        "public/test_android_circle_preview.png",
        "public/test_android_circle_preview2.png",
        "public/test_concept.png",
        "public/concept_a.png",
        "public/concept_b.png",
        "public/concept_c.png",
        "public/test_v1.png",
        "public/test_v2.png",
        "public/test_v3.png",
        "public/test_v4.png",
        "public/test_fav16.png",
        "public/test_fav32.png",
        "public/icons/test_svg.svg"
    ]
    for tf in temp_files:
        full_tf = os.path.join("D:/nav-watcher", tf)
        if os.path.exists(full_tf):
            try:
                os.remove(full_tf)
            except Exception:
                pass

    print("All production icon assets successfully generated and temporary files cleaned up!")

if __name__ == "__main__":
    build_all()
