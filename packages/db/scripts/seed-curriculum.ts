import process from "node:process";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/schema";
import { withTransaction, type Transaction } from "../src/client";

/** packages/db/scripts -> packages/db -> packages -> repo root, where `.env` lives. */
const REPO_ROOT_ENV_PATH = path.join(import.meta.dirname, "..", "..", "..", ".env");

/**
 * Seeds one course's curriculum taxonomy (units + skills/topics + a linear prerequisite chain)
 * from the hand-authored data in curriculum/_build/c_*.py — see curriculum/README.md. Transcribed
 * by hand for the pilot course (MTH-G5) rather than bridged from Python at runtime; `seedCourse`
 * is written so adding the other 21 courses later is "transcribe another `CourseSeed` object and
 * add it to `COURSES` below," no code changes.
 *
 * `mastery`/`misconceptions` are authored per-unit in the source, not per individual topic —
 * every skill/topic seeded from a unit shares that unit's mastery criteria and misconception list.
 *
 * Idempotent: every skill is upserted by its unique `key`, every unit by (courseId, orderIndex),
 * every course by `code` — safe to re-run.
 */

interface UnitSeed {
  n: number;
  nameEn: string;
  nameHy: string;
  /** Parsed as the lower bound of the source's "X–Y lessons" range. */
  lessons: number | null;
  topics: string[];
  mastery: string[];
  misconceptions: Array<{ issue: string; response: string }>;
}

interface CourseSeed {
  code: string;
  subjectKey: string;
  titleEn: string;
  gradeLabel: string;
  units: UnitSeed[];
}

const MTH_G5: CourseSeed = {
  code: "MTH-G5",
  subjectKey: "math",
  titleEn: "Grade 5 Mathematics",
  gradeLabel: "Grade 5 · typical age 10–11",
  units: [
    {
      n: 1,
      nameEn: "Place Value, Decimals, and Powers of Ten",
      nameHy: "Կարգային արժեք, տասնորդականներ և տասի աստիճաններ",
      lessons: 8,
      topics: [
        "Decimals through thousandths in standard, word, and expanded form",
        "Each place as ten times the place to its right and one tenth of the place to its left",
        "Powers of ten and exponent notation",
        "Multiplying and dividing by powers of ten and the movement of the decimal point",
        "Comparing and ordering decimals to thousandths",
        "Rounding decimals to any place",
        "Fluent multi-digit whole-number multiplication",
        "Division with two-digit divisors using partial quotients",
        "Estimating quotients",
      ],
      mastery: [
        "Compares and orders decimals to thousandths at 90% accuracy.",
        "Divides by two-digit divisors at 85% accuracy with reasoning shown.",
        "Explains the effect of multiplying by a power of ten without saying 'move the decimal'.",
      ],
      misconceptions: [
        {
          issue: "'Multiplying by ten adds a zero' — applied to decimals, giving 4.5 × 10 = 4.50.",
          response:
            "This is why the rule must never be taught as 'add a zero'. The digits shift because each is now worth ten times as much. Use a place-value chart with sliding digits.",
        },
        {
          issue: "More digits after the decimal point is read as a larger number.",
          response:
            "Compare 0.7 and 0.65 on a number line and with a thousandths grid. Annexing zeros to equalize digit counts also helps.",
        },
      ],
    },
    {
      n: 2,
      nameEn: "Adding and Subtracting Fractions with Unlike Denominators",
      nameHy: "Տարբեր հայտարարով կոտորակների գումարում և հանում",
      lessons: 8,
      topics: [
        "Why unlike denominators cannot be added directly",
        "Finding common denominators with models",
        "The least common denominator and why any common denominator works",
        "Adding and subtracting fractions with unlike denominators",
        "Adding and subtracting mixed numbers with unlike denominators, including regrouping",
        "Estimating fraction sums with benchmarks 0, 1/2, and 1",
        "Multi-step fraction word problems",
        "Assessing reasonableness of a fraction answer",
      ],
      mastery: [
        "Adds and subtracts unlike-denominator fractions at 90% accuracy.",
        "Handles mixed-number subtraction with regrouping in 4 of 5 trials.",
        "Produces a benchmark estimate before computing in 4 of 5 tasks.",
      ],
      misconceptions: [
        {
          issue: "Numerators and denominators are added separately.",
          response:
            "The defining error of Grade 5 fractions. Return to the unit-fraction meaning and to fraction strips — fourths and thirds are different-sized pieces and cannot be counted together.",
        },
        {
          issue: "Only the least common denominator is believed to work.",
          response:
            "Show that 1/2 + 1/3 gives the same result with denominator 6, 12, or 24. Understanding this frees the student from a lookup step and reduces anxiety.",
        },
      ],
    },
    {
      n: 3,
      nameEn: "Multiplying and Dividing Fractions",
      nameHy: "Կոտորակների բազմապատկում և բաժանում",
      lessons: 9,
      topics: [
        "A fraction as division: 3/4 as 3 ÷ 4",
        "Multiplying a fraction by a whole number, revisited",
        "Multiplying a fraction by a fraction with an area model",
        "The meaning of 'of' in fraction multiplication",
        "Multiplication as scaling: when does the product shrink?",
        "Multiplying mixed numbers",
        "Area of a rectangle with fractional side lengths",
        "Dividing a whole number by a unit fraction",
        "Dividing a unit fraction by a whole number",
        "Real-world division problems with fractions",
      ],
      mastery: [
        "Multiplies fractions and mixed numbers at 90% accuracy.",
        "Predicts the scaling effect correctly in 8 of 10 trials before computing.",
        "Models both unit-fraction division types correctly in 4 of 5 trials.",
      ],
      misconceptions: [
        {
          issue: "'Multiplication makes bigger; division makes smaller' persists from Grade 3.",
          response:
            "Directly confront it. Compute 6 × 1/2 and 6 ÷ 1/2 side by side and ask the student to explain the surprise. This is a genuine conceptual shift and deserves a full lesson.",
        },
        {
          issue: "Common denominators are found before multiplying fractions.",
          response:
            "Over-generalization from Unit 2. Use the area model to show why multiplication needs no common denominator — the two operations do genuinely different things.",
        },
        {
          issue: "4 ÷ 1/2 is answered as 2.",
          response:
            "Ask 'how many halves fit in 4?' and model with fraction strips. The measurement interpretation of division makes this immediate.",
        },
      ],
    },
    {
      n: 4,
      nameEn: "Decimal Operations",
      nameHy: "Գործողություններ տասնորդական կոտորակների հետ",
      lessons: 8,
      topics: [
        "Adding and subtracting decimals with place-value alignment",
        "Estimating decimal sums and differences",
        "Multiplying a decimal by a whole number",
        "Multiplying two decimals and reasoning about the decimal point",
        "Why the number of decimal places in a product is what it is",
        "Dividing a decimal by a whole number",
        "Dividing by a decimal using equivalent expressions",
        "Relating decimal operations to fraction operations",
        "Money and measurement problems with decimals",
      ],
      mastery: [
        "Computes all four decimal operations at 90% accuracy.",
        "Justifies decimal-point placement by estimation or by fraction equivalence, not by a counting rule.",
        "Solves multi-step decimal word problems correctly in 8 of 10 trials.",
      ],
      misconceptions: [
        {
          issue: "Decimals are added right-aligned like whole numbers: 3.5 + 0.42 = 3.92 becomes 3.47.",
          response:
            "Align by place value, not by the right edge. Annex zeros so both numbers show the same places; require this in writing.",
        },
        {
          issue: "The decimal-point rule for products is memorized and then misapplied.",
          response:
            "Estimate first: 4.2 × 3.1 is about 12, so the answer cannot be 1.302. Estimation makes the rule self-correcting.",
        },
      ],
    },
    {
      n: 5,
      nameEn: "Volume and Measurement",
      nameHy: "Ծավալ և չափում",
      lessons: 6,
      topics: [
        "Volume as a count of unit cubes",
        "Measuring volume by packing and by counting layers",
        "The formulas V = l × w × h and V = B × h, and why they agree",
        "Volume of solid figures composed of two right rectangular prisms",
        "Converting among units within a measurement system",
        "Multi-step measurement conversion problems",
        "Line plots with fractional data and problems drawn from them",
      ],
      mastery: [
        "Computes volume correctly with cubic units in 9 of 10 trials.",
        "Finds the volume of a composite figure in 4 of 5 trials.",
        "Performs multi-step conversions correctly in 8 of 10 trials.",
      ],
      misconceptions: [
        {
          issue: "Volume is computed by adding the three dimensions.",
          response:
            "Return to packing with unit cubes. The layer model — area of the base times the number of layers — makes multiplication necessary rather than arbitrary.",
        },
        {
          issue: "Cubic units are omitted or written as square units.",
          response: "Require units on every answer; treat wrong units as a wrong answer.",
        },
      ],
    },
    {
      n: 6,
      nameEn: "Expressions, Patterns, and the Coordinate Plane",
      nameHy: "Արտահայտություններ, օրինաչափություններ և կոորդինատային հարթություն",
      lessons: 7,
      topics: [
        "Writing and evaluating numerical expressions with parentheses, brackets, and braces",
        "Order of operations with grouping symbols",
        "Interpreting an expression without evaluating it",
        "Generating two numerical patterns from two rules",
        "Forming ordered pairs from corresponding terms",
        "The coordinate plane: axes, origin, and ordered pairs in the first quadrant",
        "Graphing points and interpreting coordinate values in context",
        "Graphing pattern relationships and describing what the graph shows",
        "A hierarchy of two-dimensional figures based on properties",
      ],
      mastery: [
        "Evaluates nested expressions correctly in 9 of 10 trials.",
        "Graphs ordered pairs accurately in 9 of 10 trials.",
        "Correctly places at least four quadrilateral types in a property hierarchy.",
      ],
      misconceptions: [
        {
          issue: "Coordinates are reversed: (3, 5) plotted as (5, 3).",
          response:
            "Use a consistent verbal routine — 'across the hall, then up the stairs' — and require the student to say it aloud until it is automatic.",
        },
        {
          issue: "Order of operations is applied strictly left to right.",
          response:
            "Grouping symbols and multiplication precedence must be practiced deliberately with contrasting pairs such as 2 + 3 × 4 and (2 + 3) × 4.",
        },
      ],
    },
  ],
};

const COURSES: CourseSeed[] = [MTH_G5];

async function seedCourse(tx: Transaction, course: CourseSeed) {
  const [subject] = await tx
    .select({ id: schema.subjects.id })
    .from(schema.subjects)
    .where(eq(schema.subjects.key, course.subjectKey))
    .limit(1);
  if (!subject)
    throw new Error(`Subject "${course.subjectKey}" not found — run "pnpm --filter @app/db seed" first.`);

  const courseId = `course_${course.code.toLowerCase()}`;
  await tx
    .insert(schema.courses)
    .values({ id: courseId, subjectId: subject.id, code: course.code, title: course.titleEn, gradeLabel: course.gradeLabel })
    .onConflictDoUpdate({
      target: schema.courses.code,
      set: { subjectId: subject.id, title: course.titleEn, gradeLabel: course.gradeLabel },
    });

  let previousUnitLastSkillId: string | null = null;
  for (const unit of course.units) {
    const unitId = `unit_${course.code.toLowerCase()}_${unit.n}`;
    await tx
      .insert(schema.curriculumUnits)
      .values({
        id: unitId,
        courseId,
        orderIndex: unit.n,
        nameEn: unit.nameEn,
        nameHy: unit.nameHy,
        lessons: unit.lessons,
      })
      .onConflictDoUpdate({
        target: [schema.curriculumUnits.courseId, schema.curriculumUnits.orderIndex],
        set: { nameEn: unit.nameEn, nameHy: unit.nameHy, lessons: unit.lessons },
      });

    let previousSkillId: string | null = previousUnitLastSkillId;
    for (const [index, topicName] of unit.topics.entries()) {
      const skillId = `skill_${course.code.toLowerCase()}_${unit.n}_${index + 1}`;
      const key = `skill:${course.code}:${unit.n}.${index + 1}`;
      const code = `${course.code}.${unit.n}.${index + 1}`;
      await tx
        .insert(schema.skills)
        .values({
          id: skillId,
          subjectId: subject.id,
          unitId,
          orderIndex: index,
          code,
          key,
          name: topicName,
          masteryCriteria: unit.mastery,
          misconceptions: unit.misconceptions,
        })
        .onConflictDoUpdate({
          target: schema.skills.key,
          set: {
            subjectId: subject.id,
            unitId,
            orderIndex: index,
            code,
            name: topicName,
            masteryCriteria: unit.mastery,
            misconceptions: unit.misconceptions,
          },
        });

      if (previousSkillId) {
        await tx
          .insert(schema.skillPrerequisites)
          .values({ skillId, prerequisiteSkillId: previousSkillId })
          .onConflictDoNothing({
            target: [schema.skillPrerequisites.skillId, schema.skillPrerequisites.prerequisiteSkillId],
          });
      }
      previousSkillId = skillId;
    }
    previousUnitLastSkillId = previousSkillId;
  }
}

async function main() {
  try {
    process.loadEnvFile(REPO_ROOT_ENV_PATH);
  } catch {
    // No root .env file (e.g. containers get DATABASE_URL from docker-compose's env_file instead).
  }

  const connectionString =
    process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/app";
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  try {
    await withTransaction(db, async (tx) => {
      for (const course of COURSES) await seedCourse(tx, course);
    });
    console.log(`Curriculum seed complete: ${COURSES.map((course) => course.code).join(", ")}.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
