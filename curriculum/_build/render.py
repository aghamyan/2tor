# -*- coding: utf-8 -*-
"""
Վարժարան / Varzharan — syllabus PDF renderer.
ReportLab + DejaVu (Armenian-capable). One PDF per course.
"""
import os, re
from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether,
                                PageBreak, ListFlowable, ListItem, HRFlowable,
                                CondPageBreak, Flowable)

# ------------------------------------------------------------------ fonts
FD = "/usr/share/fonts/truetype/dejavu"
pdfmetrics.registerFont(TTFont("Vz",     f"{FD}/DejaVuSerif.ttf"))
pdfmetrics.registerFont(TTFont("Vz-B",   f"{FD}/DejaVuSerif-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Vz-I",   f"{FD}/DejaVuSerif-Italic.ttf"))
pdfmetrics.registerFont(TTFont("Vz-BI",  f"{FD}/DejaVuSerif-BoldItalic.ttf"))
pdfmetrics.registerFontFamily("Vz", normal="Vz", bold="Vz-B", italic="Vz-I", boldItalic="Vz-BI")
pdfmetrics.registerFont(TTFont("Vs",   f"{FD}/DejaVuSansCondensed.ttf"))
pdfmetrics.registerFont(TTFont("Vs-B", f"{FD}/DejaVuSansCondensed-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Vs-I", f"{FD}/DejaVuSansCondensed-Oblique.ttf"))
pdfmetrics.registerFontFamily("Vs", normal="Vs", bold="Vs-B", italic="Vs-I", boldItalic="Vs-B")

# ------------------------------------------------------------------ palette
INK    = colors.HexColor("#1C2024")
BODY   = colors.HexColor("#2B3138")
MUTED  = colors.HexColor("#6E6257")
BRAND  = colors.HexColor("#6B1F2E")   # deep burgundy
BRAND2 = colors.HexColor("#8E3345")
GOLD   = colors.HexColor("#A8802A")
RULE   = colors.HexColor("#D9D2C6")
PANEL  = colors.HexColor("#F7F4EE")
PANEL2 = colors.HexColor("#EFEAE0")
WARN   = colors.HexColor("#FBF6EE")

PW, PH = LETTER
LM = RM = 0.82 * inch
TM = 0.95 * inch
BM = 0.80 * inch
CW = PW - LM - RM

# ------------------------------------------------------------------ styles
def P(name, **kw):
    base = dict(name=name, fontName="Vz", fontSize=9.4, leading=14.2,
                textColor=BODY, spaceBefore=0, spaceAfter=0, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(**base)

S = {
 "h1":      P("h1", fontName="Vz-B", fontSize=19, leading=23, textColor=BRAND, spaceAfter=2),
 "h1hy":    P("h1hy", fontName="Vz", fontSize=12.4, leading=16, textColor=BRAND2, spaceAfter=6),
 "h2":      P("h2", fontName="Vs-B", fontSize=11.6, leading=14, textColor=BRAND,
              spaceBefore=13, spaceAfter=1),
 "h2hy":    P("h2hy", fontName="Vs", fontSize=8.6, leading=11, textColor=MUTED, spaceAfter=5),
 "h3":      P("h3", fontName="Vs-B", fontSize=9.6, leading=12, textColor=INK,
              spaceBefore=8, spaceAfter=3),
 "body":    P("body", alignment=TA_JUSTIFY, spaceAfter=6),
 "bodyc":   P("bodyc", alignment=TA_JUSTIFY),
 "small":   P("small", fontSize=8.5, leading=12.4),
 "smallc":  P("smallc", fontSize=8.5, leading=12.4, alignment=TA_CENTER),
 "tiny":    P("tiny", fontName="Vs", fontSize=8.0, leading=11.2, textColor=MUTED),
 "th":      P("th", fontName="Vs-B", fontSize=8.1, leading=10.6, textColor=colors.white),
 "td":      P("td", fontSize=8.5, leading=12.2),
 "tdb":     P("tdb", fontName="Vz-B", fontSize=8.5, leading=12.2, textColor=INK),
 "li":      P("li", fontSize=9.2, leading=13.4, spaceAfter=2.4),
 "lism":    P("lism", fontSize=8.6, leading=12.4, spaceAfter=1.8),
 "unit_en": P("unit_en", fontName="Vz-B", fontSize=13, leading=16, textColor=colors.white, spaceAfter=1),
 "unit_hy": P("unit_hy", fontName="Vz", fontSize=9.2, leading=12, textColor=colors.HexColor("#EBD9C4")),
 "unit_no": P("unit_no", fontName="Vs-B", fontSize=8, leading=10, textColor=colors.HexColor("#E8CFA8")),
 "note":    P("note", fontName="Vz-I", fontSize=8.6, leading=12.6, textColor=colors.HexColor("#5B4A2E"),
              alignment=TA_JUSTIFY),
 "notelbl": P("notelbl", fontName="Vs-B", fontSize=7.6, leading=10, textColor=GOLD),
 "cover_k": P("cover_k", fontName="Vs-B", fontSize=7.4, leading=9.6, textColor=MUTED),
 "cover_v": P("cover_v", fontSize=8.8, leading=12.4, textColor=INK),
 "brand":   P("brand", fontName="Vz-B", fontSize=13.5, leading=16, textColor=BRAND),
 "brandsub":P("brandsub", fontName="Vs", fontSize=7.2, leading=9, textColor=MUTED),
 "code":    P("code", fontName="Vs-B", fontSize=8.4, leading=10, textColor=GOLD, alignment=2),
 "toc":     P("toc", fontSize=9.0, leading=13.4),
}

def esc(t):
    s = str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    s = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", s)      # *emphasis* -> italic
    s = re.sub(r"\^\{([^}]+)\}", r"<super>\1</super>", s)
    s = re.sub(r"_\{([^}]+)\}", r"<sub>\1</sub>", s)
    return s

# ------------------------------------------------------------------ flowables
class Rule(Flowable):
    def __init__(self, w, thick=0.7, color=RULE, space=0):
        Flowable.__init__(self); self.w=w; self.t=thick; self.c=color; self.s=space
    def wrap(self, aw, ah): return (self.w, self.t + self.s)
    def draw(self):
        self.canv.setStrokeColor(self.c); self.canv.setLineWidth(self.t)
        self.canv.line(0, self.s/2.0, self.w, self.s/2.0)

def band(text_en, text_hy, num, lessons):
    """Burgundy unit banner."""
    left = [Paragraph(f"UNIT {num} · {esc(lessons).upper()}", S["unit_no"]),
            Paragraph(esc(text_en), S["unit_en"]),
            Paragraph(esc(text_hy), S["unit_hy"])]
    t = Table([[left]], colWidths=[CW])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), BRAND),
        ("LEFTPADDING", (0,0), (-1,-1), 11), ("RIGHTPADDING", (0,0), (-1,-1), 11),
        ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("LINEBEFORE", (0,0), (0,-1), 3.5, GOLD),
    ]))
    return t

def h2(en, hy=None):
    out = [Paragraph(esc(en).upper(), S["h2"])]
    if hy: out.append(Paragraph(esc(hy), S["h2hy"]))
    out.append(Rule(CW, 0.9, GOLD, space=4))
    out.append(Spacer(1, 5))
    return out

def bullets(items, style="li", bullet="•", color=BRAND):
    return ListFlowable(
        [ListItem(Paragraph(esc(i), S[style]), leftIndent=13, value=bullet) for i in items],
        bulletType="bullet", start=bullet, leftIndent=13, bulletFontName="Vs",
        bulletFontSize=7.5, bulletColor=color, bulletOffsetY=-1)

def numbered(items, style="li"):
    return ListFlowable(
        [ListItem(Paragraph(esc(i), S[style]), leftIndent=18) for i in items],
        bulletType="1", leftIndent=18, bulletFontName="Vs-B",
        bulletFontSize=8.4, bulletColor=BRAND, bulletOffsetY=-0.5)

def kvtable(rows, w1=1.35*inch):
    data = [[Paragraph(esc(k).upper(), S["cover_k"]), Paragraph(esc(v), S["cover_v"])] for k, v in rows]
    t = Table(data, colWidths=[w1, CW-w1])
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 0), ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 4.5), ("BOTTOMPADDING", (0,0), (-1,-1), 4.5),
        ("LINEBELOW", (0,0), (-1,-2), 0.4, RULE),
    ]))
    return t

def datatable(headers, rows, widths, zebra=True):
    data = [[Paragraph(esc(h).upper(), S["th"]) for h in headers]]
    for r in rows:
        data.append([Paragraph(esc(c), S["tdb"] if i == 0 else S["td"]) for i, c in enumerate(r)])
    t = Table(data, colWidths=widths, repeatRows=1)
    st = [("BACKGROUND", (0,0), (-1,0), BRAND),
          ("VALIGN", (0,0), (-1,-1), "TOP"),
          ("LEFTPADDING", (0,0), (-1,-1), 7), ("RIGHTPADDING", (0,0), (-1,-1), 7),
          ("TOPPADDING", (0,0), (-1,-1), 5.5), ("BOTTOMPADDING", (0,0), (-1,-1), 5.5),
          ("LINEBELOW", (0,1), (-1,-1), 0.4, RULE),
          ("BOX", (0,0), (-1,-1), 0.5, RULE)]
    if zebra:
        for i in range(1, len(data)):
            if i % 2 == 0:
                st.append(("BACKGROUND", (0,i), (-1,i), PANEL))
    t.setStyle(TableStyle(st))
    return t

def notebox(text, label="TEACHING NOTE"):
    inner = [Paragraph(label, S["notelbl"]), Spacer(1, 2.5), Paragraph(esc(text), S["note"])]
    t = Table([[inner]], colWidths=[CW])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), WARN),
        ("LINEBEFORE", (0,0), (0,-1), 2.4, GOLD),
        ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    return t

def subhead(txt):
    return Paragraph(esc(txt).upper(), S["h3"])

# ------------------------------------------------------------------ doc template
class Doc(BaseDocTemplate):
    def __init__(self, path, course, **kw):
        BaseDocTemplate.__init__(self, path, pagesize=LETTER,
                                 leftMargin=LM, rightMargin=RM,
                                 topMargin=TM, bottomMargin=BM,
                                 title=f"{course['title_en']} — Varzharan Syllabus",
                                 author="Վարժարան / Varzharan",
                                 subject="Course Syllabus", **kw)
        self.course = course
        f1 = Frame(LM, BM, CW, PH-TM-BM+0.30*inch, id="first",
                   leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        f = Frame(LM, BM, CW, PH-TM-BM, id="norm",
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([
            PageTemplate(id="first", frames=[f1], onPage=self.first_page),
            PageTemplate(id="norm",  frames=[f],  onPage=self.later_page)])

    def _footer(self, c):
        c.saveState()
        c.setStrokeColor(RULE); c.setLineWidth(0.5)
        c.line(LM, BM-16, PW-RM, BM-16)
        c.setFont("Vs", 7.2); c.setFillColor(MUTED)
        c.drawString(LM, BM-27, "Վարժարան · Varzharan — %s (%s)" % (self.course["title_en"], self.course["code"]))
        c.drawRightString(PW-RM, BM-27, "Page %d" % c.getPageNumber())
        c.restoreState()

    def first_page(self, c, d):
        c.saveState()
        c.setFillColor(BRAND); c.rect(0, PH-0.30*inch, PW, 0.30*inch, stroke=0, fill=1)
        c.setFillColor(GOLD);  c.rect(0, PH-0.335*inch, PW, 0.035*inch, stroke=0, fill=1)
        c.restoreState()
        self._footer(c)

    def later_page(self, c, d):
        c.saveState()
        c.setStrokeColor(RULE); c.setLineWidth(0.5)
        c.line(LM, PH-TM+22, PW-RM, PH-TM+22)
        c.setFont("Vs", 7.2); c.setFillColor(MUTED)
        c.drawString(LM, PH-TM+28, "ՎԱՐԺԱՐԱՆ · SYLLABUS")
        c.drawRightString(PW-RM, PH-TM+28, self.course["title_en"].upper())
        c.restoreState()
        self._footer(c)

    def afterFlowable(self, fl):
        if isinstance(fl, Paragraph) and fl.style.name == "h1":
            self.handle_nextPageTemplate("norm")

# ------------------------------------------------------------------ build one course
def masthead():
    left = [Paragraph("Վարժարան", S["brand"]),
            Paragraph("VARZHARAN · ONLINE ACADEMY OF MATHEMATICS", S["brandsub"])]
    right = [Paragraph("COURSE SYLLABUS<br/>ԴԱՍԸՆԹԱՑԻ ԾՐԱԳԻՐ", S["code"])]
    t = Table([[left, right]], colWidths=[CW*0.62, CW*0.38])
    t.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP"),
                           ("LEFTPADDING", (0,0), (-1,-1), 0),
                           ("RIGHTPADDING", (0,0), (-1,-1), 0),
                           ("TOPPADDING", (0,0), (-1,-1), 0),
                           ("BOTTOMPADDING", (0,0), (-1,-1), 0)]))
    return t

def build_course(c, outdir):
    path = os.path.join(outdir, "%s — %s.pdf" % (c["code"], c["title_en"]))
    doc = Doc(path, c)
    F = []

    # ---- masthead + title
    F += [Spacer(1, 8), masthead(), Spacer(1, 10), Rule(CW, 1.6, BRAND), Spacer(1, 13)]
    F += [Paragraph(esc(c["title_en"]), S["h1"]),
          Paragraph(esc(c["title_hy"]), S["h1hy"])]
    F += [Rule(CW, 0.6, RULE), Spacer(1, 9)]

    F += [kvtable([
        ("Course code", c["code"]),
        ("Program", "%s · %s" % (c["band"], c["band_hy"])),
        ("Level", c["grade_label"]),
        ("Duration", c["hours"]),
        ("Prerequisite", c["prereq"]),
        ("Leads to", c["next"]),
    ])]

    F += h2("Course Description", "Դասընթացի նկարագրություն")
    F += [Paragraph(esc(c["description"]), S["body"])]

    F += h2("Teaching Approach", "Դասավանդման մոտեցումը Վարժարանում")
    F += [Paragraph(esc(c["philosophy"]), S["body"])]

    F += h2("Placement and Readiness Indicators", "Ընդունելություն և պատրաստվածություն")
    F += [Paragraph("The placement assessment checks each indicator below. A student missing two or more "
                    "is enrolled with a remediation plan attached to the personalized curriculum.", S["small"]),
          Spacer(1, 6),
          datatable(["Readiness indicator", "What it tells the teacher"],
                    c["readiness"], [CW*0.40, CW*0.60])]

    F += h2("Course Learning Outcomes", "Ուսումնական արդյունքներ")
    F += [Paragraph("On completion of this course the student will be able to:", S["small"]), Spacer(1, 5),
          numbered(c["outcomes"])]

    # ---- units
    F += [PageBreak()]
    F += h2("Course Units", "Դասընթացի բաժիններ")
    F += [Paragraph("Each unit below lists the lesson-level topics a teacher delivers, the objectives that define "
                    "success, the observable mastery criteria used to update the student's progress profile, and "
                    "the misconceptions this unit reliably produces together with the recommended teacher response.",
                    S["small"]), Spacer(1, 9)]

    for u in c["units"]:
        blk = [band(u["name_en"], u["name_hy"], u["n"], u["lessons"]), Spacer(1, 8),
               subhead("Topics covered"), bullets(u["topics"], "lism")]
        F.append(KeepTogether(blk))
        F += [Spacer(1, 7), subhead("Learning objectives"), numbered(u["objectives"], "lism")]
        F += [Spacer(1, 7), subhead("Mastery criteria — evidence required to mark this unit complete"),
              bullets(u["mastery"], "lism", bullet="▪", color=GOLD)]
        F += [Spacer(1, 8), subhead("Common misconceptions and teacher response"),
              datatable(["Misconception", "Recommended response"], u["misconceptions"],
                        [CW*0.36, CW*0.64])]
        F += [Spacer(1, 8), notebox(u["note"]), Spacer(1, 16)]

    # ---- assessment
    F += [CondPageBreak(3.4*inch)]
    F += h2("Assessment and Mastery Policy", "Գնահատում և յուրացման քաղաքականություն")
    F += [datatable(["Assessment", "When", "What it measures"], c["assessment"],
                    [CW*0.24, CW*0.22, CW*0.54])]
    F += [Spacer(1, 7),
          Paragraph("Վարժարան reports mastery, not grades. Each topic in the student's profile is marked "
                    "<b>Mastered</b>, <b>Developing</b>, or <b>Needs Review</b> against the criteria stated in "
                    "each unit above. A topic is marked Mastered only when the criterion is met on two separate "
                    "occasions at least one week apart — this prevents short-term recall from being recorded as "
                    "durable learning. Topics marked Needs Review are automatically re-entered into homework and "
                    "into the opening minutes of subsequent lessons until they are re-mastered.", S["small"])]

    F += [CondPageBreak(2.6*inch)]
    F += h2("Pacing Options", "Ուսումնական տեմպ")
    F += [datatable(["Track", "Cadence", "Expected completion"], c["pacing"],
                    [CW*0.24, CW*0.26, CW*0.50])]
    F += [Spacer(1, 6),
          Paragraph("Pacing is assigned after the placement assessment and reviewed at the mid-year assessment. "
                    "A student who is meeting mastery criteria early may be moved to the accelerated track; a "
                    "student who is not may be moved to intensive without any change in the course content itself.",
                    S["small"])]

    F += [CondPageBreak(2.2*inch)]
    F += h2("Homework and Independent Practice", "Տնային աշխատանք և ինքնուրույն պարապմունք")
    F += [Paragraph(esc(c["homework"]), S["body"])]

    F += [CondPageBreak(2.8*inch)]
    F += h2("Progress Milestones Reported to Parents", "Ուսումնական նվաճումներ")
    F += [Paragraph("These are the achievements the parent portal announces as the student reaches them. "
                    "They replace attendance counts as the primary measure of progress.", S["small"]),
          Spacer(1, 6), bullets(c["milestones"], "lism", bullet="◆", color=GOLD)]

    F += [CondPageBreak(2.0*inch)]
    F += h2("Materials and Resources", "Նյութեր և ռեսուրսներ")
    F += [bullets(c["materials"], "lism")]

    F += [Spacer(1, 16), Rule(CW, 0.6, RULE), Spacer(1, 6),
          Paragraph("Վարժարան · Varzharan — Exceptional Armenian educators. American academic standards. "
                    "Personalized education. &nbsp;|&nbsp; This syllabus defines the standard course. Every "
                    "enrolled student receives a personalized version of it, sequenced from their placement "
                    "assessment and revised as their progress profile changes.", S["tiny"])]

    doc.build(F)
    return path
