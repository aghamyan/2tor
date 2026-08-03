import { describe, expect, it } from "vitest";
import {
  curriculumById,
  mathematicsCurriculum,
} from "../../components/marketing/subjects/mathematics-curriculum";

const requiredTopics: Record<string, string[]> = {
  "grade-1": [
    "Counting and number sense to 120",
    "Place value with tens and ones",
    "Addition and subtraction within 20",
    "Addition and subtraction word problems",
    "Comparing numbers",
    "Measurement and length",
    "Time and money foundations",
    "Shapes and spatial reasoning",
    "Data and simple graphs",
    "Mathematical explanations",
  ],
  "grade-2": [
    "Place value to 1,000",
    "Addition and subtraction within 1,000",
    "Mental math strategies",
    "Equal groups and early multiplication",
    "Length and measurement",
    "Time and money",
    "Data and picture/bar graphs",
    "Two-dimensional and three-dimensional shapes",
    "Fractions as equal parts",
    "Multi-step reasoning",
  ],
  "grade-3": [
    "Multiplication and division",
    "Multiplication facts and strategies",
    "Place value and rounding",
    "Multi-digit addition and subtraction",
    "Fractions as numbers",
    "Fraction comparison",
    "Area and perimeter",
    "Time, mass, and volume",
    "Graphs and data",
    "Two-step word problems",
    "Geometry and shape classification",
  ],
  "grade-4": [
    "Multi-digit place value",
    "Multi-digit addition and subtraction",
    "Multiplication with larger numbers",
    "Division with remainders",
    "Factors and multiples",
    "Equivalent fractions",
    "Fraction comparison",
    "Adding and subtracting fractions",
    "Decimal foundations",
    "Angles and measurement",
    "Area and perimeter",
    "Lines, symmetry, and geometry",
    "Multi-step word problems",
  ],
  "grade-5": [
    "Decimal place value",
    "Decimal operations",
    "Multi-digit multiplication",
    "Long division",
    "Fraction addition and subtraction",
    "Fraction multiplication and division concepts",
    "Numerical expressions",
    "Coordinate plane",
    "Volume",
    "Geometry classification",
    "Patterns and relationships",
    "Multi-step problem solving",
  ],
  "grade-6": [
    "Ratios and unit rates",
    "Fractions and decimal operations",
    "Negative numbers",
    "Absolute value",
    "Expressions",
    "One-variable equations",
    "Inequalities",
    "Coordinate plane",
    "Area, surface area, and volume",
    "Statistical distributions",
    "Mean, median, and variability",
    "Percent foundations",
    "Real-world modeling",
  ],
  "grade-7": [
    "Proportional relationships",
    "Percent applications",
    "Rational number operations",
    "Expressions and equations",
    "Multi-step equations",
    "Inequalities",
    "Scale drawings",
    "Geometry constructions",
    "Circles",
    "Surface area and volume",
    "Probability",
    "Sampling and statistics",
    "Real-world problem solving",
  ],
  "grade-8": [
    "Linear equations",
    "Systems of equations",
    "Functions",
    "Slope and rate of change",
    "Graphing linear relationships",
    "Exponents and scientific notation",
    "Irrational numbers",
    "Pythagorean theorem",
    "Transformations",
    "Similarity and congruence",
    "Volume",
    "Scatter plots and data relationships",
    "Preparation for Algebra I",
  ],
  "pre-algebra": [
    "Integer and rational number fluency",
    "Ratios, proportions, and percents",
    "Algebraic expressions",
    "Multi-step equations",
    "Inequalities",
    "Graphing",
    "Functions foundations",
    "Exponents",
    "Radicals foundations",
    "Geometry review",
    "Statistics and probability",
    "Algebra readiness problem solving",
  ],
  "algebra-1": [
    "Expressions and algebraic structure",
    "Linear equations",
    "Linear inequalities",
    "Systems of equations",
    "Functions and function notation",
    "Linear functions",
    "Exponential functions",
    "Sequences",
    "Polynomial operations",
    "Factoring",
    "Quadratic equations",
    "Quadratic functions",
    "Radical expressions",
    "Data modeling",
    "Mathematical modeling and applications",
  ],
  geometry: [
    "Foundations of proof",
    "Logic and reasoning",
    "Lines and angles",
    "Transformations",
    "Triangle congruence",
    "Triangle similarity",
    "Polygons",
    "Coordinate geometry",
    "Right triangles",
    "Trigonometric ratios",
    "Circles",
    "Area and volume",
    "Geometric constructions",
    "Probability applications",
    "Formal mathematical argument",
  ],
  "algebra-2": [
    "Advanced linear equations and systems",
    "Quadratic functions",
    "Polynomial functions",
    "Polynomial division",
    "Rational expressions",
    "Rational equations",
    "Radical functions",
    "Exponential functions",
    "Logarithmic functions",
    "Complex numbers",
    "Sequences and series",
    "Conic sections",
    "Probability and statistics",
    "Function transformations",
    "Mathematical modeling",
  ],
  precalculus: [
    "Advanced function analysis",
    "Function transformations",
    "Polynomial and rational functions",
    "Exponential and logarithmic functions",
    "Trigonometric functions",
    "Unit circle",
    "Trigonometric identities",
    "Trigonometric equations",
    "Law of sines and cosines",
    "Analytic geometry",
    "Conic sections",
    "Sequences and series",
    "Parametric equations",
    "Polar coordinates",
    "Vectors",
    "Introductory limits",
    "Preparation for calculus",
  ],
};

describe("mathematics curriculum", () => {
  it("contains the complete Grade 1 through Precalculus progression", () => {
    expect(mathematicsCurriculum).toHaveLength(13);
    expect(mathematicsCurriculum.map((level) => level.id)).toEqual(Object.keys(requiredTopics));
  });

  it("keeps every required topic in a scannable learning unit", () => {
    for (const [levelId, expectedTopics] of Object.entries(requiredTopics)) {
      const level = curriculumById.get(levelId);
      expect(level, `${levelId} should exist`).toBeDefined();
      expect(level?.units.length).toBeGreaterThanOrEqual(5);
      expect(level?.units.length).toBeLessThanOrEqual(7);
      const availableTopics = new Set(level?.units.flatMap((unit) => unit.skills));
      for (const topic of expectedTopics) {
        expect(availableTopics.has(topic), `${levelId} is missing ${topic}`).toBe(true);
      }
    }
  });

  it("has unique ids and valid next-level links", () => {
    expect(new Set(mathematicsCurriculum.map((level) => level.id)).size).toBe(13);
    for (const level of mathematicsCurriculum) {
      expect(new Set(level.units.map((unit) => unit.id)).size).toBe(level.units.length);
      if (level.nextLevel) expect(curriculumById.has(level.nextLevel)).toBe(true);
    }
  });
});
