from PIL import Image

img = Image.open('.pi/acceptance/swarm2/screenshots/analyze-brilliant-ply19.png')
print(f"Image size: {img.size}")
w, h = img.size

# Board area (from Playwright bounding rect probe on same page)
board_x1, board_y1, board_x2, board_y2 = 104, 327, 664, 887

target_r, target_g, target_b = 79, 70, 229  # #4f46e5 indigo arrow color
pixels = img.load()
arrow_outside_board = []
arrow_inside_board = []

for y in range(0, h, 2):
    for x in range(0, w, 2):
        r, g, b = pixels[x, y][:3]
        if abs(r - target_r) < 40 and abs(g - target_g) < 40 and abs(b - target_b) < 40:
            if x < board_x1 or x > board_x2 or y < board_y1 or y > board_y2:
                arrow_outside_board.append((x, y))
            else:
                arrow_inside_board.append((x, y))

print(f"Indigo pixels INSIDE board area: {len(arrow_inside_board)}")
print(f"Indigo pixels OUTSIDE board area: {len(arrow_outside_board)}")
if arrow_outside_board:
    xs = [p[0] for p in arrow_outside_board]
    ys = [p[1] for p in arrow_outside_board]
    print(f"Outside-board arrow pixels x range: {min(xs)}-{max(xs)}")
    print(f"Outside-board arrow pixels y range: {min(ys)}-{max(ys)}")
    if min(xs) > board_x2:
        print("  -> Arrow pixels are to the RIGHT of the board (in/near move list!)")
    elif max(xs) < board_x1:
        print("  -> Arrow pixels are to the LEFT of the board")
    if min(ys) < board_y1:
        print("  -> Arrow pixels are ABOVE the board (in nav/header area!)")
if arrow_inside_board:
    xs = [p[0] for p in arrow_inside_board]
    ys = [p[1] for p in arrow_inside_board]
    print(f"Inside-board arrow pixels x range: {min(xs)}-{max(xs)}")
    print(f"Inside-board arrow pixels y range: {min(ys)}-{max(ys)}")
