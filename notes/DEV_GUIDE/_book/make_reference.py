#!/usr/bin/env python3
"""สร้าง reference.docx สำหรับ pandoc — ฟอนต์ Sarabun, ขนาด A4, เลขหน้า, สไตล์ตาราง/โค้ด

รันเองไม่ต้องมีอาร์กิวเมนต์:  python3 make_reference.py
ผลลัพธ์: _book/reference.docx  (build.py เรียกให้อัตโนมัติ)

แก้ลุคของเล่มทั้งเล่มได้จากค่าคงที่ด้านล่างนี้จุดเดียว
"""
import re, shutil, subprocess, sys, zipfile
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "reference.docx"
WORK = HERE / "build" / "_ref"

# ── ตั้งค่าหน้าตาเล่ม ────────────────────────────────────────────────────────
FONT_TH    = "Sarabun"        # เปลี่ยนเป็น "TH Sarabun New" ได้ถ้าต้องการฟอนต์ราชการ
FONT_MONO  = "Menlo"          # ฟอนต์โค้ด (Windows ใช้ "Consolas")
FONT_MONO_FALLBACK = "Consolas"

SZ_BODY        = 32   # half-point → 16pt
SZ_TITLE       = 64   # 32pt
SZ_SUBTITLE    = 36   # 18pt
SZ_H1          = 48   # 24pt
SZ_H2          = 38   # 19pt
SZ_H3          = 34   # 17pt
SZ_CODE_BLOCK  = 19   # 9.5pt — พอดีบรรทัดยาว ~81 ตัวอักษรในความกว้าง 16.5 ซม.
SZ_CODE_INLINE = 28   # 14pt — โค้ดในบรรทัดข้อความ
SZ_TABLE       = 28   # 14pt
SZ_CAPTION     = 26   # 13pt

C_INK      = "1B2733"   # ข้อความปกติ
C_ACCENT   = "17506B"   # หัวข้อ
C_ACCENT2  = "0E7C6B"   # หัวข้อย่อย
C_MUTED    = "5B6B7A"
C_RULE     = "C9D6E2"
C_CODE_BG  = "F4F6F8"
C_TABLE_HD = "EAF0F6"
C_QUOTE_BR = "9FB6C9"

# A4 = 11906 x 16838 twips · 1 ซม. = 566.93 twips
PG = dict(w=11906, h=16838, top=1417, right=1134, bottom=1134, left=1417)  # 2.5/2.0/2.0/2.5 ซม.

# สีของ syntax highlight (ต้องประกาศเองทุกตัว ไม่งั้น pandoc ใส่ของมันเองที่ขนาด 22)
TOKENS = {
    "NormalTok": None,        "KeywordTok": ("2E6DB4", True),
    "DataTypeTok": ("8A5A00", False), "DecValTok": ("A3527A", False),
    "BaseNTok": ("A3527A", False),    "FloatTok": ("A3527A", False),
    "ConstantTok": ("A3527A", False), "CharTok": ("2E8B57", False),
    "SpecialCharTok": ("2E8B57", False), "StringTok": ("2E8B57", False),
    "VerbatimStringTok": ("2E8B57", False), "SpecialStringTok": ("2E8B57", False),
    "ImportTok": ("2E6DB4", False),   "CommentTok": ("7A8794", False),
    "DocumentationTok": ("7A8794", False), "AnnotationTok": ("7A8794", False),
    "CommentVarTok": ("7A8794", False),    "OtherTok": ("0E7C6B", False),
    "FunctionTok": ("0E7C6B", False), "VariableTok": (C_INK, False),
    "ControlFlowTok": ("2E6DB4", True), "OperatorTok": ("8A5A00", False),
    "BuiltInTok": ("0E7C6B", False),  "ExtensionTok": (C_INK, False),
    "PreprocessorTok": ("8A5A00", False), "AttributeTok": ("8A5A00", False),
    "RegionMarkerTok": (C_MUTED, False),  "InformationTok": (C_MUTED, False),
    "WarningTok": ("C0392B", False),  "AlertTok": ("C0392B", True),
    "ErrorTok": ("C0392B", True),
}


# ── ตัวช่วยประกอบ XML ────────────────────────────────────────────────────────
# ลำดับลูกใน <w:rPr> และ <w:pPr> ถูกบังคับโดย schema ของ OOXML (CT_RPr / CT_PPr)
# ถ้าเรียงผิด Word จะขึ้น "Word found unreadable content" ตอนเปิดไฟล์
# จึงต้องประกอบผ่าน 2 ฟังก์ชันนี้เท่านั้น ห้ามต่อสตริงเอง
RPR_ORDER = ("rStyle", "rFonts", "b", "bCs", "i", "iCs", "color", "sz", "szCs", "shd", "lang")
PPR_ORDER = ("keepNext", "keepLines", "pageBreakBefore", "pBdr", "shd", "wordWrap",
             "spacing", "ind", "jc", "outlineLvl")


def rpr(font=None, mono=False, bold=False, italic=False, color=None, size=None,
        shade=None, lang=None):
    """สร้าง <w:rPr> ตามลำดับที่ schema กำหนด"""
    f = FONT_MONO if mono else font
    bits = {}
    if f:
        bits["rFonts"] = (f'<w:rFonts w:ascii="{f}" w:hAnsi="{f}" w:eastAsia="{f}" '
                          f'w:cs="{f}" w:hint="default"/>')
    if bold:
        bits["b"], bits["bCs"] = "<w:b/>", "<w:bCs/>"
    if italic:
        bits["i"], bits["iCs"] = "<w:i/>", "<w:iCs/>"
    if color:
        bits["color"] = f'<w:color w:val="{color}"/>'
    if size:
        bits["sz"] = f'<w:sz w:val="{size}"/>'
        bits["szCs"] = f'<w:szCs w:val="{size}"/>'
    if shade:
        bits["shd"] = f'<w:shd w:val="clear" w:color="auto" w:fill="{shade}"/>'
    if lang:
        bits["lang"] = lang
    return "".join(bits[k] for k in RPR_ORDER if k in bits)


def ppr(keep_next=False, keep_lines=False, page_break=False, borders=None, shade=None,
        word_wrap_off=False, before=None, after=None, line=None, left=None, right=None,
        first_line=None, jc=None, outline=None):
    """สร้าง <w:pPr> ตามลำดับที่ schema กำหนด"""
    bits = {}
    if keep_next:
        bits["keepNext"] = "<w:keepNext/>"
    if keep_lines:
        bits["keepLines"] = "<w:keepLines/>"
    if page_break:
        bits["pageBreakBefore"] = "<w:pageBreakBefore/>"
    if borders:
        bits["pBdr"] = f"<w:pBdr>{borders}</w:pBdr>"
    if shade:
        bits["shd"] = f'<w:shd w:val="clear" w:color="auto" w:fill="{shade}"/>'
    if word_wrap_off:
        bits["wordWrap"] = '<w:wordWrap w:val="off"/>'
    if before is not None or after is not None or line is not None:
        a = "".join(filter(None, [
            f' w:before="{before}"' if before is not None else "",
            f' w:after="{after}"' if after is not None else "",
            f' w:line="{line}" w:lineRule="auto"' if line is not None else ""]))
        bits["spacing"] = f"<w:spacing{a}/>"
    if left is not None or right is not None or first_line is not None:
        a = "".join(filter(None, [
            f' w:left="{left}"' if left is not None else "",
            f' w:right="{right}"' if right is not None else "",
            f' w:firstLine="{first_line}"' if first_line is not None else ""]))
        bits["ind"] = f"<w:ind{a}/>"
    if jc:
        bits["jc"] = f'<w:jc w:val="{jc}"/>'
    if outline is not None:
        bits["outlineLvl"] = f'<w:outlineLvl w:val="{outline}"/>'
    return "".join(bits[k] for k in PPR_ORDER if k in bits)


def border(edge, color=C_RULE, w=4, val="single"):
    return f'<w:{edge} w:val="{val}" w:sz="{w}" w:space="0" w:color="{color}"/>'


def para_style(sid, name, based, ppr_xml, rpr_xml, nxt=None, custom=False):
    """<w:style> ของย่อหน้า — ลำดับลูก: name, basedOn, next, qFormat, pPr, rPr"""
    c = ' w:customStyle="1"' if custom else ""
    b = f'<w:basedOn w:val="{based}"/>' if based else ""
    n = f'<w:next w:val="{nxt}"/>' if nxt else ""
    return (f'<w:style w:type="paragraph"{c} w:styleId="{sid}"><w:name w:val="{name}"/>'
            f'{b}{n}<w:qFormat/><w:pPr>{ppr_xml}</w:pPr><w:rPr>{rpr_xml}</w:rPr></w:style>')


def char_style(sid, name, based, rpr_xml):
    c = "" if sid == "VerbatimChar" else ' w:customStyle="1"'
    b = f'<w:basedOn w:val="{based}"/>' if based else ""
    return (f'<w:style w:type="character" w:customStyle="1" w:styleId="{sid}">'
            f'<w:name w:val="{name}"/>{b}<w:rPr>{rpr_xml}</w:rPr></w:style>')


def build_styles():
    """คืนรายการ XML ของสไตล์ที่จะเขียนทับ/เพิ่มลง styles.xml"""
    S = []
    body_font = dict(font=FONT_TH)

    S.append(para_style("Normal", "Normal", None,
                        ppr(after=120, line=300),
                        rpr(color=C_INK, size=SZ_BODY, **body_font)))
    S.append(para_style("BodyText", "Body Text", "Normal", ppr(before=60, after=120), ""))
    S.append(para_style("Compact", "Compact", "BodyText", ppr(before=20, after=20), "",
                        custom=True))
    S.append(para_style("FirstParagraph", "First Paragraph", "BodyText", "", "", custom=True))

    # หัวข้อ — Heading1 คือ 1 บท จึงสั่งขึ้นหน้าใหม่เสมอ
    S.append(para_style(
        "Heading1", "heading 1", "Normal",
        ppr(keep_next=True, keep_lines=True, page_break=True,
            borders=border("bottom", C_ACCENT, 8), before=0, after=240, outline=0),
        rpr(bold=True, color=C_ACCENT, size=SZ_H1, **body_font), nxt="BodyText"))
    S.append(para_style(
        "Heading2", "heading 2", "Normal",
        ppr(keep_next=True, keep_lines=True, before=320, after=100, outline=1),
        rpr(bold=True, color=C_ACCENT, size=SZ_H2, **body_font), nxt="BodyText"))
    S.append(para_style(
        "Heading3", "heading 3", "Normal",
        ppr(keep_next=True, keep_lines=True, before=240, after=80, outline=2),
        rpr(bold=True, color=C_ACCENT2, size=SZ_H3, **body_font), nxt="BodyText"))
    for lvl in (4, 5, 6):
        S.append(para_style(
            f"Heading{lvl}", f"heading {lvl}", "Normal",
            ppr(keep_next=True, keep_lines=True, before=200, after=60, outline=lvl - 1),
            rpr(bold=True, color=C_INK, size=SZ_BODY, **body_font), nxt="BodyText"))

    # หน้าปก
    S.append(para_style("Title", "Title", "Normal",
                        ppr(before=2400, after=200, jc="center"),
                        rpr(bold=True, color=C_ACCENT, size=SZ_TITLE, **body_font),
                        nxt="BodyText"))
    S.append(para_style("Subtitle", "Subtitle", "Normal",
                        ppr(before=0, after=160, jc="center"),
                        rpr(color=C_MUTED, size=SZ_SUBTITLE, **body_font), nxt="BodyText"))
    for sid, nm in (("Author", "Author"), ("Date", "Date")):
        S.append(para_style(sid, nm, "Normal", ppr(before=0, after=80, jc="center"),
                            rpr(color=C_MUTED, size=SZ_BODY, **body_font), nxt="BodyText"))

    # กล่องอ้างอิง / คำเตือน (blockquote)
    S.append(para_style("BlockText", "Block Text", "Normal",
                        ppr(borders=border("left", C_QUOTE_BR, 18), shade="F7FAFC",
                            before=140, after=140, left=340, right=200),
                        rpr(color=C_INK), nxt="BodyText"))

    # โค้ด — inline ใหญ่กว่าเพราะอยู่ปนกับข้อความ 16pt ส่วนบล็อกเล็กลงให้บรรทัดยาวพอดีหน้า
    S.append(char_style("VerbatimChar", "Verbatim Char", "DefaultParagraphFont",
                        rpr(mono=True, color=C_INK, size=SZ_CODE_INLINE, shade=C_CODE_BG)))
    S.append(para_style("SourceCode", "Source Code", "Normal",
                        ppr(keep_lines=True, borders=border("left", C_RULE, 12),
                            shade=C_CODE_BG, word_wrap_off=True,
                            before=0, after=0, line=240, left=113, right=57),
                        rpr(mono=True, color=C_INK, size=SZ_CODE_BLOCK), custom=True))
    for tok, spec in TOKENS.items():
        color, bold = spec if spec else (C_INK, False)
        S.append(char_style(tok, tok, "DefaultParagraphFont",
                            rpr(mono=True, bold=bold, color=color, size=SZ_CODE_BLOCK)))

    # รูปและคำบรรยายรูป
    S.append(para_style("Figure", "Figure", "Normal",
                        ppr(keep_next=True, before=200, after=60, jc="center"), "",
                        custom=True))
    S.append(para_style("CaptionedFigure", "Captioned Figure", "Figure",
                        ppr(keep_next=True), "", custom=True))
    S.append(para_style("Caption", "Caption", "Normal",
                        ppr(before=0, after=240, jc="center"),
                        rpr(italic=True, color=C_MUTED, size=SZ_CAPTION, **body_font)))
    S.append(para_style("ImageCaption", "Image Caption", "Caption", "", "", custom=True))

    # สารบัญ
    S.append(para_style("TOCHeading", "TOC Heading", "Heading1",
                        ppr(page_break=True, before=0, after=200, outline=9), ""))

    # ตาราง — 14pt เพื่อให้ตารางหลายคอลัมน์ยังอ่านออกในความกว้าง 16.5 ซม.
    borders_all = "".join(border(e) for e in
                          ("top", "left", "bottom", "right", "insideH", "insideV"))
    S.append(
        '<w:style w:type="table" w:default="1" w:styleId="Table"><w:name w:val="Table"/>'
        '<w:basedOn w:val="TableNormal"/><w:qFormat/>'
        f'<w:pPr>{ppr(before=40, after=40, line=260)}</w:pPr>'
        f'<w:rPr>{rpr(font=FONT_TH, size=SZ_TABLE)}</w:rPr>'
        '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/>'
        f'<w:tblBorders>{borders_all}</w:tblBorders>'
        '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>'
        '<w:bottom w:w="60" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar>'
        '</w:tblPr>'
        f'<w:tblStylePr w:type="firstRow"><w:rPr>{rpr(bold=True)}</w:rPr>'
        f'<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="{C_TABLE_HD}"/></w:tcPr>'
        '</w:tblStylePr></w:style>')
    return S


def patch_styles(xml):
    styles = build_styles()
    ids = re.findall(r'w:styleId="([^"]+)"', "".join(
        re.findall(r'<w:style [^>]*w:styleId="[^"]+"', s)[0] for s in styles))
    # ลบสไตล์เดิมที่มี id ซ้ำ แล้วค่อยเติมของเรา
    for sid in ids:
        xml = re.sub(r'<w:style\b[^>]*w:styleId="%s"\s*>.*?</w:style>' % re.escape(sid),
                     "", xml, flags=re.S)
    # ค่าเริ่มต้นของทั้งเอกสาร
    xml = re.sub(r'<w:rPrDefault>.*?</w:rPrDefault>',
                 '<w:rPrDefault><w:rPr>' + rpr(
                     font=FONT_TH, color=C_INK, size=SZ_BODY,
                     lang='<w:lang w:val="en-US" w:eastAsia="th-TH" w:bidi="th-TH"/>') +
                 '</w:rPr></w:rPrDefault>', xml, flags=re.S)
    xml = re.sub(r'<w:pPrDefault>.*?</w:pPrDefault>',
                 '<w:pPrDefault><w:pPr>' + ppr(after=120, line=300) +
                 '</w:pPr></w:pPrDefault>', xml, flags=re.S)
    return xml.replace("</w:styles>", "".join(styles) + "</w:styles>")


def patch_theme(xml):
    """ชี้ฟอนต์ธีมทั้ง major/minor มาที่ FONT_TH เผื่อสไตล์ที่ไม่ได้ประกาศ rFonts ไว้เอง"""
    out, n = re.subn(r'(<a:(?:major|minor)Font>\s*<a:latin\s+typeface=")[^"]*(")',
                     r'\g<1>' + FONT_TH + r'\g<2>', xml)
    if n != 2:
        sys.exit(f"theme1.xml: คาดว่าแทนฟอนต์ 2 จุด แต่ได้ {n}")
    return out


def patch_settings(xml):
    xml = re.sub(r'<w:updateFields[^/]*/>', '', xml)
    tag = '<w:updateFields w:val="true"/>'
    for anchor in ("<w:compat>", "<w:rsids>", "</w:settings>"):
        if anchor in xml:
            return xml.replace(anchor, tag + anchor, 1)
    return xml


FOOTER_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    '<w:p><w:pPr>' + ppr(before=0, after=0, jc="center") + '</w:pPr>'
    '<w:r><w:rPr>' + rpr(font=FONT_TH, color=C_MUTED, size=26) + '</w:rPr>'
    '<w:fldChar w:fldCharType="begin"/></w:r>'
    '<w:r><w:rPr>' + rpr(font=FONT_TH, color=C_MUTED, size=26) + '</w:rPr>'
    '<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>'
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
    '<w:r><w:rPr>' + rpr(font=FONT_TH, color=C_MUTED, size=26) + '</w:rPr><w:t>1</w:t></w:r>'
    '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>'
)

SECT_PR = (
    '<w:sectPr>'
    '<w:footerReference w:type="default" r:id="rIdFtr1"/>'
    '<w:footnotePr><w:numRestart w:val="eachSect"/></w:footnotePr>'
    f'<w:pgSz w:w="{PG["w"]}" w:h="{PG["h"]}"/>'
    f'<w:pgMar w:top="{PG["top"]}" w:right="{PG["right"]}" w:bottom="{PG["bottom"]}" '
    f'w:left="{PG["left"]}" w:header="709" w:footer="567" w:gutter="0"/>'
    '<w:cols w:space="720"/><w:docGrid w:linePitch="360"/>'
    '</w:sectPr>'
)


def main():
    if WORK.exists():
        shutil.rmtree(WORK)
    WORK.mkdir(parents=True)
    base = WORK.parent / "_pandoc-default-reference.docx"
    subprocess.run(["pandoc", "-o", str(base), "--print-default-data-file", "reference.docx"],
                   check=True)
    with zipfile.ZipFile(base) as z:
        z.extractall(WORK)

    p = WORK / "word" / "styles.xml"
    p.write_text(patch_styles(p.read_text(encoding="utf-8")), encoding="utf-8")
    p = WORK / "word" / "theme" / "theme1.xml"
    p.write_text(patch_theme(p.read_text(encoding="utf-8")), encoding="utf-8")
    p = WORK / "word" / "settings.xml"
    p.write_text(patch_settings(p.read_text(encoding="utf-8")), encoding="utf-8")

    # sectPr: ขนาดหน้า ขอบ และการอ้าง footer
    p = WORK / "word" / "document.xml"
    doc = p.read_text(encoding="utf-8")
    doc, n = re.subn(r'<w:sectPr>.*?</w:sectPr>', SECT_PR, doc, flags=re.S)
    if n != 1:
        sys.exit(f"sectPr: คาดว่าเจอ 1 ที่ แต่เจอ {n}")
    p.write_text(doc, encoding="utf-8")

    (WORK / "word" / "footer1.xml").write_text(FOOTER_XML, encoding="utf-8")

    p = WORK / "word" / "_rels" / "document.xml.rels"
    rels = p.read_text(encoding="utf-8")
    if "footer1.xml" not in rels:
        rels = rels.replace("</Relationships>",
            '<Relationship Id="rIdFtr1" Type="http://schemas.openxmlformats.org/'
            'officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>')
        p.write_text(rels, encoding="utf-8")

    p = WORK / "[Content_Types].xml"
    ct = p.read_text(encoding="utf-8")
    if "footer1.xml" not in ct:
        ct = ct.replace("</Types>",
            '<Override PartName="/word/footer1.xml" ContentType="application/vnd.'
            'openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>')
        p.write_text(ct, encoding="utf-8")

    if OUT.exists():
        OUT.unlink()
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(WORK.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(WORK).as_posix())
    print(f"เขียน {OUT.relative_to(HERE.parent.parent.parent)} "
          f"({OUT.stat().st_size:,} ไบต์) · ฟอนต์ {FONT_TH} {SZ_BODY/2:g}pt · โค้ด {FONT_MONO} {SZ_CODE_BLOCK/2:g}pt")


if __name__ == "__main__":
    main()
