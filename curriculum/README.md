# Վարժարան — Mathematics Curriculum

23 PDFs: 22 course syllabi plus a master index. 262 pages total.
Revision August 2026.

## Contents

| Code | Course | Band |
|---|---|---|
| `VZ-MASTER` | Master Curriculum Index — catalog, pathways, strands, assessment architecture | — |
| `MTH-G1`…`MTH-G5` | Grade 1–5 Mathematics | Elementary |
| `MTH-G6`…`MTH-G8` | Grade 6–8 Mathematics | Middle School |
| `MTH-PA` | Pre-Algebra (bridge course) | Middle School |
| `MTH-A1` | Algebra I | High School |
| `MTH-GE` | Geometry | High School |
| `MTH-A2` | Algebra II | High School |
| `MTH-TR` | Trigonometry (standalone) | High School |
| `MTH-PC` | Precalculus | High School |
| `MTH-ST` | Statistics (standalone) | High School |
| `MTH-CA` | Calculus | High School |
| `MTH-APCA` | AP Calculus AB | Advanced Placement |
| `MTH-APCB` | AP Calculus BC | Advanced Placement |
| `MTH-APS` | AP Statistics | Advanced Placement |
| `MTH-SAT` | SAT Mathematics | Exam Preparation |
| `MTH-ACT` | ACT Mathematics | Exam Preparation |
| `MTH-COMP` | Competition Mathematics (3 levels) | Competition |

## Structure of each syllabus

1. Course description and the Վարժարան teaching approach for that level
2. Placement and readiness indicators — and what each tells the teacher
3. Course learning outcomes
4. Unit-by-unit: lesson-level topics, objectives, **observable mastery criteria**,
   **misconceptions with recommended teacher response**, teaching note
5. Assessment and mastery policy
6. Pacing options (intensive → standard → accelerated → summer)
7. Homework and independent practice expectations
8. Progress milestones reported to parents
9. Materials and resources

The mastery criteria are written to be directly usable by the progress-tracking
system: each is an observable, countable behaviour ("solves 8 of 10 …"), not a
vague standard. The misconception tables are the part a conventional syllabus
omits and the part teachers use most.

## Regenerating

Content lives as structured Python data in `_build/`, so edits are cheap and the
PDFs are disposable artifacts.

```bash
cd _build
python3 make.py            # all 22 course PDFs
python3 make.py MTH-G3     # one course
python3 master.py          # master index
```

Requires `reportlab` and DejaVu fonts (DejaVu Serif covers the Armenian script;
`render.py` expects them at `/usr/share/fonts/truetype/dejavu`).

| File | Purpose |
|---|---|
| `render.py` | Layout, typography, brand palette, PDF assembly |
| `c_elementary.py` | Grades 1–5 course data |
| `c_middle.py` | Grades 6–8 and Pre-Algebra |
| `c_highschool.py` | Algebra I → Calculus |
| `c_advanced.py` | AP, SAT/ACT, Competition |
| `master.py` | Master index (catalog, pathways, strands) |
| `schema.md` | Course dict schema |

## Maintenance note

Exam format details in `MTH-APCA`, `MTH-APCB`, `MTH-APS`, `MTH-SAT`, and
`MTH-ACT` were verified against published College Board and ACT information in
**August 2026**. Formats change — re-verify each academic year and update the
`assessment` entries in `c_advanced.py`.

Problem-bank item counts in the Materials sections are targets, not inventory.
