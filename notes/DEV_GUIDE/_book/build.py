#!/usr/bin/env python3
"""ประกอบ notes/DEV_GUIDE/*.md ทั้ง 18 ไฟล์เป็นเล่มเดียว แล้วแปลงเป็น .docx

    python3 build.py            สร้าง WiMaRC-Dev-Guide.docx
    python3 build.py --keep-md  เก็บไฟล์ markdown ที่ประกอบแล้วไว้ดูใน build/

ไม่แก้ไฟล์บทต้นฉบับ ทุกอย่างแปลงในหน่วยความจำ
แก้ฟอนต์/ขนาด/สี → make_reference.py · แก้ตำแหน่งรูป → ตาราง DIAGRAMS ด้านล่าง
"""
import re, subprocess, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).parent
GUIDE = HERE.parent
OUT = GUIDE / "WiMaRC-Dev-Guide.docx"
BUILD = HERE / "build"
BOX = re.compile(r"[─│┌┐└┘├┤┬┴┼►◄▲▼═║╔╗╚╝→←↑↓①②③④]")

# ── ลำดับบทในเล่ม ───────────────────────────────────────────────────────────
CHAPTERS = ["README.md"] + [f"{i:02d}-*.md" for i in range(17)]

# ── รูปประกอบ: id ต้องตรงกับชื่อไฟล์ใน diagrams/<id>.svg ─────────────────────
#   replace_box  = แทนที่บล็อก ASCII (บล็อกที่มีอักขระเส้น) บล็อกแรกของบทนั้น
#   after        = แทรกรูปต่อจากย่อหน้า/ตารางที่มีบรรทัดตรงกับข้อความนี้
DIAGRAMS = [
    dict(id="system-overview", chapter="02", replace_box=True,
         caption="ภาพรวมระบบ — 5 ชิ้นส่วน และ 2 เส้นทางข้อมูลที่มาเจอกันที่ฐานข้อมูล"),
    dict(id="three-channels", chapter="02",
         after="และมีหน้าให้คนนอกขอคีย์เองที่",
         caption="3 ช่องทางเข้าถึงข้อมูล และวิธียืนยันตัวตนของแต่ละช่องทาง"),
    dict(id="folder-map", chapter="04",
         after="ที่เหลือเป็นของที่เครื่องมือสร้างให้เอง",
         caption="แผนที่โฟลเดอร์ — แก้อะไร ไปที่ไหน"),
    dict(id="data-path", chapter="07", replace_box=True,
         caption="เส้นทางของค่าเซนเซอร์ 1 ค่า จากตารางในฐานข้อมูลถึงการ์ดบนหน้าจอ"),
    dict(id="rbac", chapter="08",
         after="ของจริงคือฝั่ง backend เสมอ",
         caption="การตรวจสิทธิ์ 3 ชั้น — ต้องผ่านครบทุกชั้นจึงจะเขียนข้อมูลได้"),
    dict(id="two-databases", chapter="09",
         after="เหตุผลคือแยกความรับผิดชอบ",
         caption="ฐานข้อมูลเดียว แต่ต่อ 2 ทาง และการแปลงรหัสสถานี"),
    dict(id="add-value-6-points", chapter="11",
         after="| 6 | build ทั้ง backend และ frontend | ทำให้มีผลจริง |",
         caption="6 จุดที่ต้องแก้เมื่อเพิ่มค่าใหม่ 1 ค่า — ข้ามจุดใดจุดหนึ่งค่าจะหายเงียบ ๆ"),
    dict(id="build-deploy", chapter="13",
         after="| ไฟล์ใน `notes/` | ไม่ต้องทำอะไร |",
         caption="ค่าที่ฝังตอน build เทียบกับค่าที่อ่านตอนรัน และขั้นตอน deploy/ย้อนกลับ"),
    dict(id="troubleshoot-ladder", chapter="14", replace_box=True,
         caption="บันไดไล่ปัญหา 4 ขั้น — หาให้เจอก่อนว่าขาดตอนที่ขั้นไหน"),
]


def die(msg):
    sys.exit(f"build.py: {msg}")


def chapter_files():
    files = []
    for pat in CHAPTERS:
        hits = sorted(GUIDE.glob(pat))
        if len(hits) != 1:
            die(f"รูปแบบ {pat!r} ควรตรงกับไฟล์เดียว แต่เจอ {len(hits)}")
        files.append(hits[0])
    return files


def fence_spans(lines):
    """คืนช่วง (start, end) ของทุก code fence โดยนับเฉพาะรั้วระดับบนสุด"""
    spans, open_at, lang = [], None, None
    for i, l in enumerate(lines):
        m = re.match(r"^```(\S*)\s*$", l)
        if not m:
            continue
        if open_at is None:
            open_at, lang = i, m.group(1)
        elif m.group(1) == "":
            spans.append((open_at, i, lang))
            open_at = None
    if open_at is not None:
        die(f"เจอ code fence ที่ไม่ได้ปิดที่บรรทัด {open_at + 1}")
    return spans


def strip_readme(text):
    """README → คำนำ: ตัดสารบัญ (Word สร้างเอง) และหมายเหตุสำหรับคนจัดเล่ม"""
    text = text.replace("# คู่มือพัฒนาเว็บ WiMaRC — ฉบับเริ่มจากศูนย์", "# คำนำ", 1)
    # ตัดส่วนที่มีไว้สำหรับคนอ่านใน repo เท่านั้น ไม่ควรอยู่ในเล่ม:
    # สารบัญ (Word สร้างเอง) และหมายเหตุเรื่องวิธี build เล่ม
    for start, stop in (("## สารบัญ", "## วิธีอ่าน"),
                        ("## ฉบับรวมเล่ม (.docx)", None)):
        i = text.find(start)
        if i < 0:
            die(f"ไม่พบหัวข้อ {start!r} ใน README.md")
        j = text.find(stop) if stop else len(text)
        if j < 0:
            die(f"ไม่พบหัวข้อ {stop!r} ใน README.md")
        text = text[:i] + text[j:]
    return re.sub(r"\n---\s*\n\s*$", "\n", text.rstrip()) + "\n"


def figure_md(diag, number):
    svg = HERE / "diagrams" / f"{diag['id']}.svg"
    if not svg.exists():
        die(f"ไม่มีไฟล์รูป {svg.relative_to(HERE)}")
    cap = f"รูปที่ {number} — {diag['caption']}"
    return f"![{cap}](diagrams/{diag['id']}.svg)"


def apply_diagrams(path, text, diags, counter):
    lines = text.split("\n")
    for d in diags:
        fig = figure_md(d, counter[0])
        counter[0] += 1
        if d.get("replace_box"):
            spans = [(a, b) for a, b, lang in fence_spans(lines)
                     if lang == "" and BOX.search("\n".join(lines[a + 1:b]))]
            if not spans:
                die(f"{path.name}: ไม่พบบล็อก ASCII สำหรับรูป {d['id']}")
            a, b = spans[0]
            lines[a:b + 1] = [fig]
        else:
            fenced = {i for a, b, _ in fence_spans(lines) for i in range(a, b + 1)}
            hits = [i for i, l in enumerate(lines)
                    if d["after"] in l and i not in fenced]
            if len(hits) != 1:
                die(f"{path.name}: ข้อความยึดตำแหน่ง {d['after']!r} "
                    f"เจอ {len(hits)} ที่ (ต้องเจอ 1)")
            j = hits[0]
            while j + 1 < len(lines) and lines[j + 1].strip():
                j += 1
            lines[j + 1:j + 1] = ["", fig]
    return "\n".join(lines)


def check_headings(path, text):
    lines = text.split("\n")
    fenced = {i for a, b, _ in fence_spans(lines) for i in range(a, b + 1)}
    h1 = [l for i, l in enumerate(lines) if l.startswith("# ") and i not in fenced]
    if len(h1) != 1:
        die(f"{path.name}: ต้องมีหัวข้อระดับ 1 ไฟล์ละ 1 อัน แต่เจอ {len(h1)}")
    return h1[0][2:].strip()


def assemble():
    counter, parts, titles = [1], [], []
    for path in chapter_files():
        text = path.read_text(encoding="utf-8")
        if path.name == "README.md":
            text = strip_readme(text)
        else:
            num = path.name[:2]
            diags = [d for d in DIAGRAMS if d["chapter"] == num]
            if diags:
                text = apply_diagrams(path, text, diags, counter)
        titles.append(check_headings(path, text))
        parts.append(text.rstrip() + "\n")
    used = counter[0] - 1
    if used != len(DIAGRAMS):
        die(f"วางรูปได้ {used} จาก {len(DIAGRAMS)} รูป")
    return "\n\n".join(parts), titles


# ลำดับลูกของ element เหล่านี้ถูกบังคับโดย schema ของ OOXML
# เรียงผิด = Word ขึ้น "Word found unreadable content" ตอนเปิดไฟล์ จึงต้องตรวจทุกครั้ง
WNS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
CHILD_ORDER = {
    "rPr": ["rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike",
            "dstrike", "outline", "shadow", "emboss", "imprint", "noProof", "snapToGrid",
            "vanish", "webHidden", "color", "spacing", "w", "kern", "position", "sz", "szCs",
            "highlight", "u", "effect", "bdr", "shd", "fitText", "vertAlign", "rtl", "cs",
            "em", "lang", "eastAsianLayout", "specVanish", "oMath"],
    "pPr": ["pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl",
            "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens",
            "kinsoku", "wordWrap", "overflowPunct", "topLinePunct", "autoSpaceDE",
            "autoSpaceDN", "bidi", "adjustRightInd", "snapToGrid", "spacing", "ind",
            "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection",
            "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr",
            "sectPr", "pPrChange"],
    "style": ["name", "aliases", "basedOn", "next", "link", "autoRedefine", "hidden",
              "uiPriority", "semiHidden", "unhideWhenUsed", "qFormat", "locked", "personal",
              "personalCompose", "personalReply", "rsid", "pPr", "rPr", "tblPr", "trPr",
              "tcPr", "tblStylePr"],
    "sectPr": ["headerReference", "footerReference", "footnotePr", "endnotePr", "type",
               "pgSz", "pgMar", "paperSrc", "pgBorders", "lnNumType", "pgNumType", "cols",
               "formProt", "vAlign", "noEndnote", "titlePg", "textDirection", "bidi",
               "rtlGutter", "docGrid", "printerSettings", "sectPrChange"],
}


def schema_order_errors(xml):
    """หา element ที่เรียงลูกผิดลำดับตาม schema"""
    errs = []
    for el in ET.fromstring(xml).iter():
        order = CHILD_ORDER.get(el.tag.replace(WNS, ""))
        if not order:
            continue
        seen, prev = -1, None
        for k in (c.tag.replace(WNS, "") for c in el if c.tag.startswith(WNS)):
            if k not in order:
                continue
            i = order.index(k)
            if i < seen:
                errs.append(f"<w:{el.tag.replace(WNS, '')}>: w:{k} มาหลัง w:{prev}")
                break
            seen, prev = i, k
    return errs


def verify(docx, titles):
    with zipfile.ZipFile(docx) as z:
        names = z.namelist()
        doc = z.read("word/document.xml").decode()
        styles = z.read("word/styles.xml").decode()
    svgs = [n for n in names if n.startswith("word/media/") and n.endswith(".svg")]
    pngs = [n for n in names if n.startswith("word/media/") and n.endswith(".png")]
    h1 = len(re.findall(r'<w:pStyle w:val="Heading1"\s*/>', doc))
    h2 = len(re.findall(r'<w:pStyle w:val="Heading2"\s*/>', doc))
    problems = []
    if h1 != len(titles):
        problems.append(f"หัวข้อบท: คาด {len(titles)} เจอ {h1}")
    if len(svgs) != len(DIAGRAMS):
        problems.append(f"รูป SVG: คาด {len(DIAGRAMS)} เจอ {len(svgs)}")
    if len(pngs) != len(DIAGRAMS):
        problems.append(f"รูปสำรอง PNG: คาด {len(DIAGRAMS)} เจอ {len(pngs)}")
    if "word/footer1.xml" not in names:
        problems.append("ไม่มี footer (เลขหน้า)")
    if 'w:ascii="Menlo"' not in styles:
        problems.append("สไตล์โค้ดไม่ได้ใช้ฟอนต์ Menlo")
    if styles.count('w:val="Sarabun"') + styles.count('w:ascii="Sarabun"') == 0:
        problems.append("ไม่พบฟอนต์ Sarabun ใน styles.xml")
    if 'w:styleId="SourceCode"' not in styles:
        problems.append("ไม่มีสไตล์ SourceCode")
    for tok in ("KeywordTok", "StringTok", "CommentTok"):
        if f'w:styleId="{tok}"' not in styles:
            problems.append(f"ไม่มีสไตล์ {tok}")
    for sid, want in (("SourceCode", 'w:fill="F4F6F8"'), ("Table", "w:insideH"),
                      ("Heading1", "pageBreakBefore"), ("VerbatimChar", 'w:val="28"'),
                      ("KeywordTok", 'w:val="19"'), ("NormalTok", 'w:val="19"')):
        m = re.search(r'<w:style\b(?=[^>]*w:styleId="%s")[^>]*>.*?</w:style>' % sid,
                      styles, re.S)
        if not m:
            problems.append(f"ไม่มีสไตล์ {sid}")
        elif want not in m.group(0):
            problems.append(f"สไตล์ {sid} ถูก pandoc เขียนทับ (ไม่พบ {want})")

    with zipfile.ZipFile(docx) as z:
        for part in z.namelist():
            if part.endswith(".xml") and part.startswith("word/"):
                for e in schema_order_errors(z.read(part).decode()):
                    problems.append(f"{part} ผิดลำดับตาม schema: {e}")
    print(f"  บท {h1} · หัวข้อหลัก {h2} · รูป {len(svgs)} SVG + {len(pngs)} PNG สำรอง"
          f" · ลำดับ XML ตรง schema")
    if problems:
        print("  ตรวจไม่ผ่าน:")
        for p in problems:
            print(f"    - {p}")
        return False
    print("  ตรวจผ่านทุกข้อ")
    return True


def main():
    BUILD.mkdir(parents=True, exist_ok=True)
    print("1/3 สร้าง reference.docx")
    subprocess.run([sys.executable, str(HERE / "make_reference.py")], check=True)

    print("2/3 ประกอบบทเป็นไฟล์เดียว")
    body, titles = assemble()
    md = BUILD / "book.md"
    md.write_text(body, encoding="utf-8")
    print(f"  {len(titles)} บท · {len(body.splitlines()):,} บรรทัด")

    print("3/3 แปลงเป็น .docx")
    subprocess.run([
        "pandoc", str(HERE / "metadata.yaml"), str(md),
        "--from", "markdown",
        "--reference-doc", str(HERE / "reference.docx"),
        "--resource-path", str(HERE),
        "--toc", "--toc-depth=2",
        "--dpi=96",
        "--output", str(OUT),
    ], check=True, cwd=HERE)

    ok = verify(OUT, titles)
    print(f"\n{'สำเร็จ' if ok else 'สร้างไฟล์แล้วแต่ตรวจไม่ผ่าน'}: "
          f"{OUT.relative_to(GUIDE.parent.parent)} ({OUT.stat().st_size:,} ไบต์)")
    if "--keep-md" not in sys.argv:
        md.unlink()
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
