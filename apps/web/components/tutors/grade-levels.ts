import type { TutorGradeRangeRecord } from "../../../../packages/domain/tutors/models";

/**
 * `TutorGradeRangeRecord` stores contiguous min/max integer ranges (-2..20), not a per-subject,
 * per-course list — there is no "Algebra I" or "Pre-Algebra" column anywhere in the schema. The
 * editor lets a tutor think in discrete grades (matching how the product spec describes it and how
 * families actually search), then this module merges the selection into the range shape the
 * database expects. Only Kindergarten through Grade 12 are exposed as checkboxes: those are the
 * only values this product has a settled label for. "Adult learners" is its own toggle, backed by
 * a dedicated `{ minGrade: null, maxGrade: null, includesAdult: true }` row.
 */
export interface GradeGroup {
  id: "elementary" | "middle" | "high";
  grades: readonly number[];
}

export const GRADE_GROUPS: readonly GradeGroup[] = [
  { id: "elementary", grades: [0, 1, 2, 3, 4, 5] },
  { id: "middle", grades: [6, 7, 8] },
  { id: "high", grades: [9, 10, 11, 12] },
];

export function gradeLabel(grade: number): string {
  return grade === 0 ? "K" : String(grade);
}

export type GradeRangeInput = { minGrade: number | null; maxGrade: number | null; includesAdult: boolean };

export interface GradeSelection {
  grades: Set<number>;
  includesAdult: boolean;
  /**
   * Ranges the checkbox grid cannot represent — anything outside 0..12, or open-ended on one side
   * (the schema only requires min <= max when *both* are non-null, so a one-sided row is valid
   * data). Kept verbatim and re-emitted by `rangesFromGrades()` so saving an unrelated edit (e.g.
   * languages, which shares this same PUT) never silently deletes grade data this editor can't
   * display. A tutor with only representable ranges gets an empty array here.
   */
  preserved: GradeRangeInput[];
}

function isFullyRepresentable(range: TutorGradeRangeRecord): boolean {
  if (range.includesAdult) return range.minGrade === null && range.maxGrade === null;
  return (
    range.minGrade !== null &&
    range.maxGrade !== null &&
    range.minGrade >= 0 &&
    range.maxGrade <= 12
  );
}

export function gradesFromRanges(ranges: readonly TutorGradeRangeRecord[]): GradeSelection {
  const grades = new Set<number>();
  let includesAdult = false;
  const preserved: GradeRangeInput[] = [];
  for (const range of ranges) {
    if (range.includesAdult) includesAdult = true;
    if (!isFullyRepresentable(range)) {
      // The dedicated adult-learner marker (null/null/true) *is* fully representable via the
      // toggle above, so only push non-adult, non-representable rows here.
      if (!(range.includesAdult && range.minGrade === null && range.maxGrade === null)) {
        preserved.push({
          minGrade: range.minGrade,
          maxGrade: range.maxGrade,
          includesAdult: range.includesAdult,
        });
      }
      continue;
    }
    if (range.includesAdult) continue; // the adult marker row itself, already counted above
    for (let grade = range.minGrade as number; grade <= (range.maxGrade as number); grade += 1) {
      grades.add(grade);
    }
  }
  return { grades, includesAdult, preserved };
}

/** Merges the checked discrete grades into the fewest contiguous ranges, appends a dedicated
 * adult-learner row when that toggle is on, then re-attaches whatever `gradesFromRanges()` couldn't
 * represent — mirrors its read direction so nothing round-trips into data loss. */
export function rangesFromGrades(
  grades: ReadonlySet<number>,
  includesAdult: boolean,
  preserved: readonly GradeRangeInput[] = [],
): GradeRangeInput[] {
  const sorted = [...grades].sort((a, b) => a - b);
  const merged: Array<{ minGrade: number; maxGrade: number }> = [];
  for (const grade of sorted) {
    const last = merged[merged.length - 1];
    if (last && grade === last.maxGrade + 1) last.maxGrade = grade;
    else merged.push({ minGrade: grade, maxGrade: grade });
  }
  const result: GradeRangeInput[] = merged.map((range) => ({ ...range, includesAdult: false }));
  if (includesAdult) result.push({ minGrade: null, maxGrade: null, includesAdult: true });
  result.push(...preserved);
  return result;
}
