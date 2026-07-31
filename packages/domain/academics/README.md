# Academics

Lesson feedback is human-written. Every published feedback record requires: topics covered,
objective result, assignment status, neutral engagement observation, strengths, skills to improve,
next focus, homework, parent action, student action, milestone progress, confidence, and free text.
`assignmentAccuracyNote` and `staffOnlyNote` are optional. Use an explicit value such as “None”
where no action or homework is needed; do not omit the structured field.

Staff-only notes are never included in `getParentVisibleFeedback`; UI/API callers must also gate
academic record access through `authorize(actor, "academic.view_record", studentResource)`.

Milestones use the schema categories and remain parent-visible. Completing one requires at least
one evidence record: assignment result, project rubric, tutor observation, assessment, or file.
“At risk” is shown to families as the temporary, non-labeling status “Needs attention”; abandoned
is shown as “Paused.”

Learning plans are append-only versions. A revision changing the main goal or dropping an exam
goal is saved as pending and cannot replace the active snapshot until a linked parent acknowledges
the specific version.
