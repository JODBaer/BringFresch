"""App-Icons für den Homescreen erzeugen (grüner Grund, weisser Korb mit Blatt).
   python tools/make_icons.py   -> static/icon-180.png, icon-192.png, icon-512.png, icon-maskable-512.png
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "static"
GREEN, DARK, WHITE, LEAF = (46, 125, 50), (27, 94, 32), (255, 255, 255), (165, 214, 167)
S = 1024


def leaf(d, cx, cy, length, width, angle, fill):
    """Blatt aus zwei Kreisbögen, gedreht um angle (Grad)."""
    pts = []
    for i in range(41):
        t = i / 40
        x = (t - 0.5) * length
        y = math.sin(t * math.pi) * width / 2
        pts.append((x, -y))
    for i in range(40, -1, -1):
        t = i / 40
        x = (t - 0.5) * length
        y = math.sin(t * math.pi) * width / 2
        pts.append((x, y))
    a = math.radians(angle)
    d.polygon([(cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)) for x, y in pts], fill=fill)


def draw(scale):
    """scale < 1 lässt Rand für «maskable» (Android schneidet Kreis/Rundung aus)."""
    img = Image.new("RGB", (S, S), GREEN)
    d = ImageDraw.Draw(img)
    # sanfter Verlauf nach unten (Material: Licht von oben)
    for y in range(S):
        f = y / S
        c = tuple(int(GREEN[i] * (1 - f * 0.25) + DARK[i] * f * 0.25) for i in range(3))
        d.line([(0, y), (S, y)], fill=c)
    k = scale
    c = S / 2
    # Blätter oben aus dem Korb
    leaf(d, c - 70 * k, c - 150 * k, 300 * k, 120 * k, -60, LEAF)
    leaf(d, c + 60 * k, c - 170 * k, 340 * k, 130 * k, -115, WHITE)
    # Korb: Trapez + Rand
    top, bot = c - 30 * k, c + 250 * k
    d.rounded_rectangle([c - 330 * k, top - 40 * k, c + 330 * k, top + 40 * k], radius=40 * k, fill=WHITE)
    d.polygon([(c - 280 * k, top + 30 * k), (c + 280 * k, top + 30 * k), (c + 210 * k, bot), (c - 210 * k, bot)], fill=WHITE)
    # Rillen im Korb
    for x in (-120, 0, 120):
        d.line([(c + x * k, top + 90 * k), (c + x * 0.8 * k, bot - 50 * k)], fill=GREEN, width=int(34 * k))
    return img


def save(img, size, name):
    img.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
    print(name)


full = draw(1.0)
save(full, 180, "icon-180.png")
save(full, 192, "icon-192.png")
save(full, 512, "icon-512.png")
save(draw(0.78), 512, "icon-maskable-512.png")
