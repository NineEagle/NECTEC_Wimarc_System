#!/usr/bin/env python3
"""เครื่องมือวาด SVG อย่างง่าย ใช้ร่วมกันทุกรูปในเล่ม เพื่อให้สี/ฟอนต์/หัวลูกศรเหมือนกันหมด

ข้อจำกัดที่ตั้งใจ: ใช้เฉพาะ rect / line / polygon / path / text เท่านั้น
ไม่ใช้ marker, filter, foreignObject — เพราะต้องเรนเดอร์ได้ทั้งใน Word และใน rsvg-convert
(rsvg เป็นตัวสร้าง PNG สำรองให้ Word รุ่นเก่า)
"""
FONT = "Sarabun, 'Noto Sans Thai', 'Helvetica Neue', sans-serif"
MONO = "Menlo, Consolas, monospace"

INK, MUTED, RULE = "#1B2733", "#5B6B7A", "#C9D6E2"
PAPER = "#FFFFFF"

TONES = {
    "web":     ("#2563A8", "#E8F0FA"),   # หน้าเว็บ / Next.js
    "api":     ("#0E7C6B", "#E4F3F0"),   # FastAPI
    "db":      ("#8A5A00", "#FBF0DC"),   # ฐานข้อมูล
    "device":  ("#7A5AA8", "#F0EBF8"),   # อุปกรณ์ / PHP เดิม
    "danger":  ("#C0392B", "#FBEAE7"),   # คำเตือน / ถูกปฏิเสธ
    "neutral": ("#5B6B7A", "#F1F4F7"),   # ทั่วไป
    "ok":      ("#2E7D32", "#E8F5E9"),   # สำเร็จ
}


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


class SVG:
    def __init__(self, w, h):
        self.w, self.h, self.parts = w, h, []

    # ── รูปทรงพื้นฐาน ────────────────────────────────────────────────────
    def rect(self, x, y, w, h, fill=PAPER, stroke=RULE, rx=7, sw=1.2, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ' stroke="none"'
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
                          f'fill="{fill}"{st}{d}/>')
        return self

    def line(self, x1, y1, x2, y2, color=RULE, sw=1.4, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
                          f'stroke="{color}" stroke-width="{sw}"{d}/>')
        return self

    def poly(self, pts, fill):
        s = " ".join(f"{a},{b}" for a, b in pts)
        self.parts.append(f'<polygon points="{s}" fill="{fill}"/>')
        return self

    def text(self, x, y, s, size=13, fill=INK, weight=None, anchor="start",
             font=None, opacity=None):
        w = f' font-weight="{weight}"' if weight else ""
        o = f' opacity="{opacity}"' if opacity else ""
        self.parts.append(
            f'<text x="{x}" y="{y}" font-family="{font or FONT}" font-size="{size}" '
            f'fill="{fill}" text-anchor="{anchor}"{w}{o}>{esc(s)}</text>')
        return self

    def code(self, x, y, s, size=11, fill=INK, anchor="start"):
        return self.text(x, y, s, size=size, fill=fill, anchor=anchor, font=MONO)

    # ── ชิ้นส่วนประกอบ ──────────────────────────────────────────────────
    def panel(self, x, y, w, h, label=None, tone="neutral", dash=None):
        stroke, fill = TONES[tone]
        self.rect(x, y, w, h, fill=fill, stroke=stroke, rx=10, sw=1.3, dash=dash)
        if label:
            # 6.4 px/ตัวอักษร คือค่าประมาณของ Sarabun ที่ 12px (ไทยแคบกว่าละติน)
            self.rect(x + 12, y - 10, 6.4 * len(label) + 20, 20, fill=stroke, stroke=None, rx=10)
            self.text(x + 21, y + 4, label, size=12, fill="#FFFFFF", weight="600")
        return self

    def box(self, x, y, w, h, title, sub=None, tone="neutral", mono_sub=False,
            title_size=13, bar=True):
        stroke, fill = TONES[tone]
        self.rect(x, y, w, h, fill=PAPER, stroke=stroke, rx=7, sw=1.3)
        if bar:
            self.parts.append(
                f'<path d="M{x + 7},{y} h-3 a4,4 0 0 0 -4,4 v{h - 8} a4,4 0 0 0 4,4 h3 z" '
                f'fill="{stroke}"/>')
        cx = x + w / 2
        if sub:
            self.text(cx, y + h / 2 - 2, title, size=title_size, weight="600", anchor="middle")
            if mono_sub:
                self.code(cx, y + h / 2 + 15, sub, size=10.5, fill=MUTED, anchor="middle")
            else:
                self.text(cx, y + h / 2 + 15, sub, size=11, fill=MUTED, anchor="middle")
        else:
            self.text(cx, y + h / 2 + 5, title, size=title_size, weight="600", anchor="middle")
        return self

    def badge(self, cx, cy, label, tone="neutral", r=13):
        stroke, fill = TONES[tone]
        self.parts.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{stroke}"/>')
        self.text(cx, cy + 4.5, label, size=12, fill="#FFFFFF", weight="700", anchor="middle")
        return self

    def chip(self, x, y, label, tone="neutral", h=22, pad=9, size=11, mono=True):
        stroke, fill = TONES[tone]
        w = (6.3 if mono else 6.8) * len(label) + pad * 2
        self.rect(x, y, w, h, fill=fill, stroke=stroke, rx=5, sw=1)
        if mono:
            self.code(x + pad, y + h / 2 + 4, label, size=size, fill=stroke)
        else:
            self.text(x + pad, y + h / 2 + 4, label, size=size, fill=stroke, weight="600")
        return w

    # ── ลูกศร (วาดหัวเป็น polygon เอง ไม่ใช้ marker) ──────────────────────
    def _head(self, x, y, direction, color, s=6):
        if direction == "r":
            pts = [(x, y), (x - s * 1.5, y - s * 0.8), (x - s * 1.5, y + s * 0.8)]
        elif direction == "l":
            pts = [(x, y), (x + s * 1.5, y - s * 0.8), (x + s * 1.5, y + s * 0.8)]
        elif direction == "d":
            pts = [(x, y), (x - s * 0.8, y - s * 1.5), (x + s * 0.8, y - s * 1.5)]
        else:
            pts = [(x, y), (x - s * 0.8, y + s * 1.5), (x + s * 0.8, y + s * 1.5)]
        return self.poly(pts, color)

    def arrow(self, x1, y1, x2, y2, color=MUTED, label=None, dash=None, sw=1.6,
              label_size=10.5, label_dy=-7, label_dx=0):
        """ลูกศรตรง แนวนอนหรือแนวตั้งเท่านั้น"""
        if y1 == y2:
            d = "r" if x2 > x1 else "l"
            end = x2 - 8 if d == "r" else x2 + 8
            self.line(x1, y1, end, y2, color, sw, dash)
        else:
            d = "d" if y2 > y1 else "u"
            end = y2 - 8 if d == "d" else y2 + 8
            self.line(x1, y1, x2, end, color, sw, dash)
        self._head(x2, y2, d, color)
        if label:
            mx, my = (x1 + x2) / 2 + label_dx, (y1 + y2) / 2 + label_dy
            anchor = "middle" if y1 == y2 else "start"
            self.text(mx, my, label, size=label_size, fill=color, anchor=anchor)
        return self

    def elbow(self, x1, y1, x2, y2, color=MUTED, first="h", label=None, dash=None, sw=1.6):
        """ลูกศรหักฉาก: ไปแนวนอนก่อน (h) หรือแนวตั้งก่อน (v)"""
        if first == "h":
            self.line(x1, y1, x2, y1, color, sw, dash)
            d = "d" if y2 > y1 else "u"
            self.line(x2, y1, x2, y2 - 8 if d == "d" else y2 + 8, color, sw, dash)
        else:
            self.line(x1, y1, x1, y2, color, sw, dash)
            d = "r" if x2 > x1 else "l"
            self.line(x1, y2, x2 - 8 if d == "r" else x2 + 8, y2, color, sw, dash)
        self._head(x2, y2, d, color)
        if label:
            self.text((x1 + x2) / 2, y1 - 7, label, size=10.5, fill=color, anchor="middle")
        return self

    # ── บันทึก ──────────────────────────────────────────────────────────
    def save(self, path):
        body = "\n  ".join(self.parts)
        path.write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
            f'viewBox="0 0 {self.w} {self.h}">\n'
            f'  <rect width="{self.w}" height="{self.h}" fill="{PAPER}"/>\n  {body}\n</svg>\n',
            encoding="utf-8")
        return path
