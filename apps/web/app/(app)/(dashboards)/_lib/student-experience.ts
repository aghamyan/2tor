import type { StudentProfileRecord } from "../../../../../../packages/domain/families/index";

export type StudentExperience = "younger" | "older";

function ageOn(dateOfBirth: string, now: Date): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  let age = now.getUTCFullYear() - year;
  if (now.getUTCMonth() + 1 < month) age -= 1;
  return age >= 0 ? age : null;
}

function ageBandExperience(ageBand: string): StudentExperience | null {
  const normalized = ageBand.toLocaleLowerCase();
  if (/adult|18\+|college/.test(normalized)) return "older";
  if (/under|younger|child|elementary|primary/.test(normalized)) return "younger";
  const ages = normalized.match(/\d+/g)?.map(Number) ?? [];
  if (ages.length === 0) return null;
  if (Math.max(...ages) <= 12) return "younger";
  if (Math.min(...ages) >= 13) return "older";
  return null;
}

function gradeExperience(grade: string): StudentExperience | null {
  const normalized = grade.toLocaleLowerCase().trim();
  if (/kindergarten|^k$|elementary|primary/.test(normalized)) return "younger";
  if (/adult|college|university|postsecondary/.test(normalized)) return "older";
  const gradeNumber = Number(normalized.match(/\d+/)?.[0]);
  if (!Number.isFinite(gradeNumber)) return null;
  return gradeNumber <= 6 ? "younger" : "older";
}

/**
 * Uses privacy-minimized age fields in order of confidence. Unknown profiles receive the
 * information-dense older view, avoiding a childlike presentation based on a guess.
 */
export function studentExperienceFor(
  profile: Pick<StudentProfileRecord, "isAdultLearner" | "dobYearMonth" | "ageBand" | "gradeLevel">,
  now = new Date(),
): StudentExperience {
  if (profile.isAdultLearner) return "older";

  if (profile.dobYearMonth) {
    const age = ageOn(profile.dobYearMonth, now);
    if (age !== null) return age < 13 ? "younger" : "older";
  }

  if (profile.ageBand) {
    const experience = ageBandExperience(profile.ageBand);
    if (experience) return experience;
  }

  if (profile.gradeLevel) {
    const experience = gradeExperience(profile.gradeLevel);
    if (experience) return experience;
  }

  return "older";
}
