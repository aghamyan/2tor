# -*- coding: utf-8 -*-
"""Varzharan — Master Curriculum Index."""
import os, sys, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render
from render import (S, CW, LM, RM, TM, BM, PW, PH, esc, h2, bullets, numbered,
                    datatable, kvtable, notebox, subhead, Rule, masthead,
                    BRAND, GOLD, RULE, MUTED, INK, PANEL, WARN, colors, inch)
from reportlab.platypus import (Paragraph, Spacer, Table, TableStyle, PageBreak,
                                KeepTogether, CondPageBreak)
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.enums import TA_JUSTIFY

CATALOG = {
    "code": "VZ-MASTER",
    "title_en": "Master Curriculum Index",
    "title_hy": "Ուսումնական ծրագրերի ընդհանուր ցանկ",
}

COURSES = [
    # code, title_en, title_hy, band, typical, prereq, pages
    ("MTH-G1", "Grade 1 Mathematics", "Մաթեմատիկա — 1-ին դասարան", "Elementary", "Grade 1", "Counts to 20; numerals 0–10"),
    ("MTH-G2", "Grade 2 Mathematics", "Մաթեմատիկա — 2-րդ դասարան", "Elementary", "Grade 2", "MTH-G1"),
    ("MTH-G3", "Grade 3 Mathematics", "Մաթեմատիկա — 3-րդ դասարան", "Elementary", "Grade 3", "MTH-G2"),
    ("MTH-G4", "Grade 4 Mathematics", "Մաթեմատիկա — 4-րդ դասարան", "Elementary", "Grade 4", "MTH-G3"),
    ("MTH-G5", "Grade 5 Mathematics", "Մաթեմատիկա — 5-րդ դասարան", "Elementary", "Grade 5", "MTH-G4"),
    ("MTH-G6", "Grade 6 Mathematics", "Մաթեմատիկա — 6-րդ դասարան", "Middle School", "Grade 6", "MTH-G5"),
    ("MTH-G7", "Grade 7 Mathematics", "Մաթեմատիկա — 7-րդ դասարան", "Middle School", "Grade 7", "MTH-G6"),
    ("MTH-G8", "Grade 8 Mathematics", "Մաթեմատիկա — 8-րդ դասարան", "Middle School", "Grade 8", "MTH-G7"),
    ("MTH-PA", "Pre-Algebra", "Նախահանրահաշիվ", "Middle School", "Grades 7–9 · bridge", "MTH-G6 or placement"),
    ("MTH-A1", "Algebra I", "Հանրահաշիվ I", "High School", "Grades 8–9", "MTH-G8 or MTH-PA"),
    ("MTH-GE", "Geometry", "Երկրաչափություն", "High School", "Grades 9–10", "MTH-A1"),
    ("MTH-A2", "Algebra II", "Հանրահաշիվ II", "High School", "Grades 10–11", "MTH-A1 + MTH-GE"),
    ("MTH-TR", "Trigonometry", "Եռանկյունաչափություն", "High School", "Grades 10–12 · standalone", "MTH-A2 or concurrent"),
    ("MTH-PC", "Precalculus", "Նախամաթանալիզ", "High School", "Grades 11–12", "MTH-A2"),
    ("MTH-ST", "Statistics", "Վիճակագրություն", "High School", "Grades 10–12 · standalone", "MTH-A1"),
    ("MTH-CA", "Calculus", "Մաթեմատիկական անալիզ", "High School", "Grades 11–12", "MTH-PC"),
    ("MTH-APCA", "AP Calculus AB", "AP Մաթեմատիկական անալիզ AB", "Advanced Placement", "Grades 11–12", "MTH-PC"),
    ("MTH-APCB", "AP Calculus BC", "AP Մաթեմատիկական անալիզ BC", "Advanced Placement", "Grades 11–12", "MTH-PC or MTH-APCA"),
    ("MTH-APS", "AP Statistics", "AP Վիճակագրություն", "Advanced Placement", "Grades 10–12", "MTH-A2"),
    ("MTH-SAT", "SAT Mathematics", "SAT մաթեմատիկա", "Exam Preparation", "Grades 10–12", "MTH-A1 + MTH-GE"),
    ("MTH-ACT", "ACT Mathematics", "ACT մաթեմատիկա", "Exam Preparation", "Grades 10–12", "MTH-A1 + MTH-GE"),
    ("MTH-COMP", "Competition Mathematics", "Օլիմպիադային մաթեմատիկա", "Competition", "Grades 5–12 · 3 levels", "Placement only"),
]

PATHWAYS = [
    ("Standard", "G1 → G2 → G3 → G4 → G5 → G6 → G7 → G8 → Algebra I → Geometry → Algebra II → Precalculus",
     "Algebra I in Grade 9. Precalculus in Grade 12. Calculus is not reached in secondary school. This is the "
     "majority pathway in American public schools and is entirely sufficient for most university programmes."),
    ("Accelerated", "… → G6 → G7 → G8 (compacted) → Algebra I (Gr 8) → Geometry → Algebra II → Precalculus → AP Calculus AB",
     "Algebra I in Grade 8, reached by compacting Grades 7 and 8 across two years. Ends with AP Calculus AB in "
     "Grade 12. Recommended when the Grade 6 end-of-course assessment shows strong ratio reasoning and "
     "computational fluency."),
    ("Advanced", "… → G5 → G6/G7 compacted → Algebra I (Gr 7) → Geometry → Algebra II → Precalculus → AP Calculus BC → university mathematics",
     "Algebra I in Grade 7. Reaches AP Calculus BC in Grade 11 and leaves Grade 12 open for university-level "
     "coursework. Requires a strong Grade 5 profile and, in practice, genuine enthusiasm rather than only "
     "capability — this pathway is a poor fit for a capable student who does not want it."),
    ("Statistics-focused", "… → Algebra I → Geometry → Algebra II → Statistics → AP Statistics",
     "For students heading toward the social sciences, life sciences, business, medicine, or journalism, where "
     "statistical literacy matters more than calculus. AP Statistics requires only Algebra II and may be taken "
     "as early as Grade 10."),
    ("Examination", "Any pathway + SAT Mathematics or ACT Mathematics in Grades 10–12",
     "Runs alongside the main pathway rather than replacing it, typically as a 12–16 week course timed to a "
     "specific test date. Students preparing for both examinations should take the diagnostic for each and "
     "commit to the format that suits them."),
    ("Competition", "Competition Mathematics Levels I–III, alongside any pathway",
     "Placed by assessment rather than by age. Level I aligns to AMC 8, Level II to AMC 10/12, and Level III to "
     "AIME and olympiad work. Runs in parallel with the school pathway throughout."),
]

STRANDS = [
    ("Number and Operations",
     "Counting and cardinality (G1) → place value and regrouping (G2–G4) → fractions as numbers (G3) → "
     "fraction and decimal operations (G4–G5) → ratio and rate (G6) → rational numbers with negatives (G6–G7) → "
     "the real numbers and irrationals (G8) → complex numbers (Algebra II)."),
    ("Algebraic Thinking",
     "Equal groups and arrays (G2–G3) → the equals sign as balance (G1–G6) → expressions and one-step equations "
     "(G6) → multi-step equations (G7) → linear functions and systems (G8) → the function families (Algebra I, "
     "Algebra II) → structural analysis and modelling (Precalculus)."),
    ("Geometry and Measurement",
     "Shapes and fair shares (G1) → length and area (G2–G3) → angles and classification (G4) → volume and the "
     "coordinate plane (G5) → polygon area and nets (G6) → circles and scale (G7) → transformations, congruence, "
     "and the Pythagorean theorem (G8) → formal proof and trigonometry (Geometry)."),
    ("Data, Statistics, and Probability",
     "Picture and bar graphs (G2) → scaled graphs and line plots (G3–G5) → distributions and variability (G6) → "
     "sampling and probability models (G7) → bivariate data and the line of best fit (G8) → regression and "
     "correlation (Algebra I) → full inference (Statistics, AP Statistics)."),
    ("Reasoning and Proof",
     "Explaining a strategy aloud (G1–G3) → justifying with a model (G4–G5) → arguing from structure (G6–G8) → "
     "justifying algebraic steps by property (Algebra I) → formal deductive proof (Geometry) → mathematical "
     "induction (Precalculus) → written justification under examination conditions (AP courses) → complete "
     "olympiad write-ups (Competition)."),
]

HIGH_STAKES = [
    ("Grade 3 — Fractions as numbers",
     "Fraction failure in Grades 5–7 is almost always traceable to a Grade 3 unit taught with area models alone. "
     "Վարժարան requires the number line in every fraction lesson. A standalone Fractions Intensive is offered "
     "as remediation for students in Grades 4–6."),
    ("Grade 3 — Multiplication fact automaticity",
     "The strongest single predictor of Grade 5–7 performance. Fluency work continues in every lesson from Unit 2 "
     "of Grade 3 through the end of Grade 4, regardless of the current topic."),
    ("Grade 6 — Ratio reasoning",
     "The strongest predictor of Algebra I performance. Cross-multiplication is deliberately withheld until "
     "ratio tables, tape diagrams, and double number lines are secure, because students who acquire the shortcut "
     "early cannot solve non-routine problems in Grade 7."),
    ("Grade 8 — The function concept",
     "Function notation is introduced deliberately early. Students comfortable with f(x) in Grade 8 have a "
     "measurably easier Algebra I, and the cost of introducing it early is low."),
    ("Algebra II / Precalculus — Algebraic automaticity",
     "Students fail Calculus for algebraic reasons far more often than conceptual ones. Precalculus is treated "
     "as an algebra course with a calculus horizon, and cumulative algebra maintenance appears in every "
     "assignment."),
    ("AP courses — Written justification",
     "The largest source of avoidable AP score loss is insufficient justification, not conceptual weakness. "
     "Justification is trained from Unit 1 of every AP course rather than in a spring review."),
]


def build(outdir):
    path = os.path.join(outdir, "VZ-MASTER — Varzharan Mathematics Curriculum Index.pdf")
    doc = render.Doc(path, {"code": CATALOG["code"], "title_en": "Master Curriculum Index"})
    F = []

    F += [Spacer(1, 8), masthead(), Spacer(1, 10), Rule(CW, 1.6, BRAND), Spacer(1, 13)]
    F += [Paragraph("Mathematics Curriculum — Master Index", S["h1"]),
          Paragraph("Մաթեմատիկայի ուսումնական ծրագիր — ընդհանուր ցանկ", S["h1hy"])]
    F += [Rule(CW, 0.6, RULE), Spacer(1, 9)]

    F += [kvtable([
        ("Scope", "Grade 1 through university-level preparation · 22 courses"),
        ("Bands", "Elementary · Middle School · High School · Advanced Placement · Examination Preparation · Competition"),
        ("Alignment", "American academic standards, with a Վարժարան progression designed for one-to-one instruction"),
        ("Document", "This index maps the full catalog. Each course has its own complete syllabus."),
        ("Revision", "August 2026"),
    ])]

    F += h2("How This Curriculum Is Used", "Ինչպես է կիրառվում այս ծրագիրը")
    F += [Paragraph(
        "Every syllabus in this catalog defines the <b>standard course</b>. No student receives the standard "
        "course unchanged. After the placement assessment, Վարժարան produces a personalized version of the "
        "syllabus for that student: units they have already mastered are compressed or removed, gaps found "
        "upstream are inserted before the content that depends on them, and the pacing track is chosen from the "
        "options each syllabus lists. The personalized syllabus is visible to the parent in the parent portal "
        "and is revised whenever the progress profile changes materially.", S["body"])]
    F += [Paragraph(
        "This is the difference between Վարժարան and a tutoring marketplace. A tutor delivers lessons. A school "
        "delivers a curriculum, assesses against it, reports progress in terms of it, and adjusts it when the "
        "evidence says to. The syllabi in this catalog are what make that possible: they state, in advance and "
        "in public, what will be taught, what mastery looks like, how it will be measured, and what the student "
        "will be able to do at the end.", S["body"])]

    F += h2("Course Catalog", "Դասընթացների ցանկ")
    SHORT = {"Elementary": "Elem.", "Middle School": "Middle", "High School": "High",
             "Advanced Placement": "AP", "Exam Preparation": "Exam prep", "Competition": "Contest"}
    rows = [(c[0].replace("-", "\u2011"), c[1] + " \u00b7 " + c[2],
             SHORT[c[3]], c[4], c[5].replace("-", "\u2011"))
            for c in COURSES]
    F += [datatable(["Code", "Course", "Band", "Typical level", "Prerequisite"],
                    rows, [CW*0.145, CW*0.345, CW*0.125, CW*0.175, CW*0.21])]

    F += [PageBreak()]
    F += h2("Pathways Through the Curriculum", "Ուսումնական ուղիներ")
    F += [Paragraph(
        "The same catalog supports several routes. The pathway is assigned after the placement assessment and "
        "reviewed at each end-of-course assessment; a student may move between pathways in either direction "
        "without repeating content, because the courses themselves do not change — only the sequence and the "
        "pace do.", S["small"]), Spacer(1, 8)]

    for name, seq, desc in PATHWAYS:
        blk = [Paragraph(esc(name).upper(), S["h3"]),
               Paragraph("<b>%s</b>" % esc(seq), S["small"]),
               Spacer(1, 3),
               Paragraph(esc(desc), S["small"]),
               Spacer(1, 9)]
        F.append(KeepTogether(blk))

    F += [Spacer(1, 4), notebox(
        "A pathway is a plan, not a verdict. Վարժարան does not place a Grade 5 student on a track that "
        "determines whether they will see calculus. Acceleration is offered when the evidence supports it and "
        "withdrawn when it does not, and a student who moves from accelerated to standard has lost nothing but "
        "time pressure. The most common error in American mathematics placement is accelerating a student who is "
        "fast but not secure; the resulting gaps surface two years later, in Algebra II, when they are expensive "
        "to close.", "PLACEMENT PRINCIPLE")]

    F += [CondPageBreak(3*inch)]
    F += h2("Vertical Strands", "Ուղղահայաց թեմատիկ գծեր")
    F += [Paragraph(
        "Five ideas run the length of the curriculum. Teachers are asked to name the connection aloud when a "
        "strand resurfaces — a student who is told that the Grade 3 area model is the same picture as the "
        "Algebra I binomial product retains both better than a student left to notice it.", S["small"]),
        Spacer(1, 8)]
    for name, desc in STRANDS:
        blk = [Paragraph(esc(name).upper(), S["h3"]),
               Paragraph(esc(desc), S["small"]), Spacer(1, 8)]
        F.append(KeepTogether(blk))

    F += [PageBreak()]
    F += h2("High-Consequence Points in the Curriculum", "Ծրագրի առանցքային կետերը")
    F += [Paragraph(
        "A small number of moments in a mathematics education account for a disproportionate share of later "
        "success and failure. These are the points where Վարժարան deliberately spends more time than the "
        "calendar suggests, and where the placement assessment looks hardest.", S["small"]), Spacer(1, 8)]
    F += [datatable(["Point", "Why it matters and what Վարժարան does"], HIGH_STAKES,
                    [CW*0.30, CW*0.70])]

    F += [CondPageBreak(3.2*inch)]
    F += h2("Assessment Architecture", "Գնահատման կառուցվածք")
    F += [datatable(["Assessment", "When", "Purpose"], [
        ("Placement Assessment", "Before enrollment",
         "Produces the structured academic profile: current knowledge, gaps, curriculum alignment, and the "
         "recommended course, pathway, and pacing track."),
        ("Unit Check", "End of every unit",
         "Measures the mastery criteria stated in that unit. A failed check returns the student to targeted "
         "lessons rather than advancing the syllabus."),
        ("Fluency Probe", "Every 2nd or 3rd lesson",
         "Short timed retrieval of the skills the current course assumes. Prevents the silent decay that "
         "causes mid-year decline."),
        ("Diagnostic Checkpoint", "At high-consequence points",
         "Fractions in Grades 3–5, ratio reasoning in Grade 6, the function concept in Grade 8, algebraic "
         "automaticity before Calculus. Failure triggers remediation before new content is layered on."),
        ("Mid-Year Assessment", "Roughly halfway",
         "Cumulative. Triggers a pacing review and, where warranted, a pathway change."),
        ("End-of-Course Assessment", "End of course",
         "All course outcomes. Determines the next course, the pathway, and the pacing, and produces the "
         "formal readiness recommendation reported to the parent."),
    ], [CW*0.22, CW*0.18, CW*0.60])]

    F += [Spacer(1, 8)]
    F += [Paragraph(
        "Վարժարան reports <b>mastery, not grades</b>. Every topic in a student's profile is marked Mastered, "
        "Developing, or Needs Review against the criteria stated in the relevant unit of the relevant syllabus. "
        "A topic is marked Mastered only when the criterion is met on two separate occasions at least a week "
        "apart, which prevents short-term recall from being recorded as durable learning. Topics marked Needs "
        "Review re-enter homework and the opening minutes of subsequent lessons automatically until they are "
        "re-mastered.", S["body"])]

    F += [CondPageBreak(3*inch)]
    F += h2("What Every Syllabus Contains", "Ինչ է պարունակում յուրաքանչյուր ծրագիր")
    F += [Paragraph("Each of the twenty-two course syllabi follows the same structure, so that a teacher moving "
                    "between courses and a parent reading across years both know where to look:", S["small"]),
          Spacer(1, 6),
          numbered([
              "Course description and the Վարժարան teaching approach for that level.",
              "Placement and readiness indicators, with what each tells the teacher.",
              "Course learning outcomes.",
              "Unit-by-unit breakdown: lesson-level topics, learning objectives, observable mastery criteria, "
              "the misconceptions the unit reliably produces with the recommended teacher response, and a "
              "teaching note.",
              "Assessment and mastery policy.",
              "Pacing options, from intensive remediation to acceleration.",
              "Homework and independent practice expectations.",
              "Progress milestones reported to parents.",
              "Materials and resources.",
          ], "li")]

    F += [Spacer(1, 10), notebox(
        "The misconception tables are the part of these syllabi that a teacher will use most and that a "
        "conventional syllabus omits entirely. They exist because the single most valuable thing an experienced "
        "teacher knows is not what to teach but what will go wrong — and because a one-to-one lesson is the "
        "setting in which that knowledge produces the most value. A teacher who recognizes an error as the "
        "additive-ratio misconception rather than as carelessness fixes it in one lesson. A teacher who does not "
        "reteaches the procedure, and the error returns.", "WHY THE MISCONCEPTION TABLES EXIST")]

    F += [Spacer(1, 16), Rule(CW, 0.6, RULE), Spacer(1, 6),
          Paragraph("Վարժարան · Varzharan — Exceptional Armenian educators. American academic standards. "
                    "Personalized education. &nbsp;|&nbsp; Master Curriculum Index, revision August 2026. "
                    "Examination format details for AP, SAT, and ACT courses were verified against published "
                    "College Board and ACT information in August 2026 and should be re-verified each academic year.",
                    S["tiny"])]

    doc.build(F)
    return path


if __name__ == "__main__":
    OUT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    os.makedirs(OUT, exist_ok=True)
    print(build(OUT))
