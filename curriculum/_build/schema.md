# Varzharan Syllabus Schema

Each course is a Python dict:

```
{
  "code":        "MTH-G1",
  "title_en":    "Grade 1 Mathematics",
  "title_hy":    "Մաթեմատիկա — 1-ին դասարան",
  "band":        "Elementary Mathematics",
  "band_hy":     "Տարրական մաթեմատիկա",
  "grade_label": "Typical age 6–7 · Grade 1",
  "hours":       "60–72 instructional hours",
  "prereq":      "...",
  "next":        "...",
  "description": "paragraph",
  "philosophy":  "paragraph on how Varzharan teaches this level",
  "readiness":   [ (indicator, meaning) ... ]   # placement signals
  "outcomes":    [ "..." ]                      # 6-9 course-level outcomes
  "units": [
    {
      "n": 1,
      "name_en": "...",
      "name_hy": "...",
      "lessons": "6–8 lessons",
      "topics":   ["lesson-level topic", ...],
      "objectives": ["The student will ...", ...],
      "mastery":  ["observable criterion", ...],
      "misconceptions": [(misconception, teacher response), ...],
      "note": "teaching note paragraph"
    }
  ],
  "assessment":  [(name, weight/when, what it measures)],
  "pacing":      [(track, cadence, completion)],
  "homework":    "paragraph",
  "milestones":  ["Mastered ...", ...],
  "materials":   ["..."],
}
```
