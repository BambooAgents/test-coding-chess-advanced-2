"""Detect arrow bleed by looking for indigo pixels in regions where NO indigo UI element should be.

The arrow color #4f46e5 == --accent. UI elements using --accent:
  - Load PGN button (in the left input panel, x<660, y~200-260)
  - Active nav tab "Analyze" (top nav bar, y~10-50)
  - Selected square outline (on the board)

The MOVE LIST panel (x:676-956) should have ZERO indigo pixels.
If we find indigo in the move list region, that's arrow bleed.
"""
from PIL import Image
import sys

def probe(path, board=(104, 327, 664, 887), movelist=(676, 369, 956, 729)):
    img = Image.open(path)
    w, h = img.size
    pixels = img.load()
    target = (79, 70, 229)
    # Just use fixed regions but check image bounds
    ml_x1, ml_y1, ml_x2, ml_y2 = movelist
    ml_x2 = min(ml_x2, w - 1)
    ml_y2 = min(ml_y2, h - 1)
    in_movelist = 0
    in_movelist_pts = []
    for y in range(ml_y1, ml_y2, 2):
        for x in range(ml_x1, ml_x2, 2):
            r, g, b = pixels[x, y][:3]
            if abs(r - target[0]) < 40 and abs(g - target[1]) < 40 and abs(b - target[2]) < 40:
                in_movelist += 1
                in_movelist_pts.append((x, y))
    print(f"{path}")
    print(f"  size: {w}x{h}")
    print(f"  indigo pixels in MOVE LIST region ({ml_x1}-{ml_x2}, {ml_y1}-{ml_y2}): {in_movelist}")
    if in_movelist_pts:
        xs = [p[0] for p in in_movelist_pts]
        ys = [p[1] for p in in_movelist_pts]
        print(f"    x: {min(xs)}-{max(xs)}, y: {min(ys)}-{max(ys)}")
        print(f"    >>> ARROW BLEED INTO MOVE LIST CONFIRMED")
    else:
        print(f"    >>> move list clean (no arrow bleed)")
    print()

probe('.pi/acceptance/swarm2/screenshots/analyze-brilliant-ply19.png')
probe('.pi/acceptance/swarm2/screenshots/analyze-scrub-ply6.png')
probe('.pi/acceptance/swarm2/screenshots/analyze-complete-ply21.png')
probe('.pi/acceptance/swarm2/screenshots/user-arrow-check.png')
