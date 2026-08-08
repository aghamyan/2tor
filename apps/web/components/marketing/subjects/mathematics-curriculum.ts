export type CurriculumCategory = "elementary" | "middle" | "high";

export type CurriculumUnit = {
  id: string;
  title: string;
  summary: string;
  skills: string[];
  dependency: string;
};

export type CurriculumLevel = {
  id: string;
  title: string;
  shortTitle: string;
  category: CurriculumCategory;
  focus: string;
  readinessLabel: string;
  summary: string;
  bestFor: string[];
  prerequisites: string[];
  outcomes: string[];
  nextLevel?: string;
  nextDescription?: string;
  units: CurriculumUnit[];
};

const unit = (
  id: string,
  title: string,
  summary: string,
  dependency: string,
  skills: string[],
): CurriculumUnit => ({ id, title, summary, dependency, skills });

export const mathematicsCurriculum: CurriculumLevel[] = [
  {
    id: "grade-1",
    title: "Grade 1 Mathematics",
    shortTitle: "Grade 1",
    category: "elementary",
    focus: "Numbers, addition, subtraction, and shapes",
    readinessLabel: "Foundation",
    summary:
      "A confident beginning with numbers, operations, measurement, shapes, and explaining mathematical ideas.",
    bestFor: [
      "Students currently in Grade 1",
      "Kindergarten students ready for more",
      "Grade 2 students rebuilding number confidence",
    ],
    prerequisites: [
      "Count objects to 20",
      "Recognize written numerals",
      "Compare small groups",
      "Name common shapes",
    ],
    outcomes: [
      "Count, read, and compare numbers to 120",
      "Add and subtract within 20 with flexible strategies",
      "Solve and explain simple story problems",
      "Measure, tell time, and interpret simple graphs",
      "Describe and compose two- and three-dimensional shapes",
    ],
    nextLevel: "grade-2",
    nextDescription:
      "This level prepares students to work with place value to 1,000, larger operations, equal groups, and fractions as equal parts.",
    units: [
      unit(
        "counting-number-sense",
        "Counting and number sense",
        "Students connect quantities, number names, and written numerals instead of relying on recitation alone.",
        "Comfort counting small groups of objects",
        [
          "Counting and number sense to 120",
          "Comparing numbers",
          "One more, one less, and number patterns",
        ],
      ),
      unit(
        "place-value",
        "Tens, ones, and place value",
        "Bundles and visual models make two-digit numbers concrete and understandable.",
        "Counting reliably to 100",
        [
          "Place value with tens and ones",
          "Reading and writing two-digit numbers",
          "Comparing two-digit numbers",
        ],
      ),
      unit(
        "addition-subtraction",
        "Addition and subtraction",
        "Students build meaning, fluency, and flexible strategies for operations within 20.",
        "Counting on and counting back",
        [
          "Addition and subtraction within 20",
          "Addition and subtraction word problems",
          "Unknowns in simple equations",
        ],
      ),
      unit(
        "measurement-time-money",
        "Measurement, time, and money",
        "Everyday comparisons help students see mathematics in length, clocks, and coins.",
        "Compare objects by size",
        ["Measurement and length", "Time and money foundations", "Ordering objects by length"],
      ),
      unit(
        "shapes-space",
        "Shapes and spatial reasoning",
        "Students describe, combine, and partition shapes using precise spatial language.",
        "Name circles, triangles, and rectangles",
        ["Shapes and spatial reasoning", "Compose and partition shapes", "Equal shares and halves"],
      ),
      unit(
        "data-explanations",
        "Data and mathematical explanations",
        "Simple graphs become a way to ask questions, compare information, and explain an answer.",
        "Sort objects by one attribute",
        [
          "Data and simple graphs",
          "Mathematical explanations",
          "Choose a strategy and explain why it works",
        ],
      ),
    ],
  },
  {
    id: "grade-2",
    title: "Grade 2 Mathematics",
    shortTitle: "Grade 2",
    category: "elementary",
    focus: "Place value, larger operations, measurement, and early fractions",
    readinessLabel: "Build fluency",
    summary:
      "A structured path from three-digit place value to fluent operations, measurement, data, shapes, and early multiplication ideas.",
    bestFor: [
      "Students currently in Grade 2",
      "Grade 1 students ready to move ahead",
      "Grade 3 students strengthening arithmetic foundations",
    ],
    prerequisites: [
      "Numbers to 120",
      "Addition within 20",
      "Tens and ones",
      "Basic shapes",
      "Read an analog clock to the hour",
    ],
    outcomes: [
      "Read, compare, and represent numbers to 1,000",
      "Add and subtract within 1,000 using place-value strategies",
      "Use equal groups to prepare for multiplication",
      "Measure length and solve time and money problems",
      "Read graphs and reason about shapes and equal parts",
    ],
    nextLevel: "grade-3",
    nextDescription:
      "This level prepares students for multiplication and division, fractions as numbers, area, perimeter, and two-step problems.",
    units: [
      unit(
        "place-value-1000",
        "Place value to 1,000",
        "Students see how hundreds, tens, and ones compose every three-digit number.",
        "Tens and ones",
        [
          "Place value to 1,000",
          "Compare and order three-digit numbers",
          "Skip-count by 5s, 10s, and 100s",
        ],
      ),
      unit(
        "operations-1000",
        "Addition, subtraction, and mental math",
        "Visual models and written strategies build accuracy without losing number sense.",
        "Addition and subtraction within 20",
        ["Addition and subtraction within 1,000", "Mental math strategies", "Multi-step reasoning"],
      ),
      unit(
        "equal-groups",
        "Equal groups and early multiplication",
        "Arrays and repeated groups introduce the structure behind multiplication.",
        "Skip-counting",
        [
          "Equal groups and early multiplication",
          "Odd and even numbers",
          "Repeated addition with arrays",
        ],
      ),
      unit(
        "measurement",
        "Length, time, and money",
        "Students choose units, use tools, and solve everyday measurement problems.",
        "Compare lengths and identify coins",
        ["Length and measurement", "Time and money", "Estimate and compare measurements"],
      ),
      unit(
        "data",
        "Data and graphs",
        "Picture and bar graphs help students organize information and answer comparison questions.",
        "Sort and count objects",
        [
          "Data and picture/bar graphs",
          "Create a graph from data",
          "Solve one- and two-step graph problems",
        ],
      ),
      unit(
        "shapes-fractions",
        "Shapes and equal parts",
        "Geometry and fraction language meet as students partition shapes into equal shares.",
        "Name common two-dimensional shapes",
        [
          "Two-dimensional and three-dimensional shapes",
          "Fractions as equal parts",
          "Describe sides, angles, faces, and vertices",
        ],
      ),
    ],
  },
  {
    id: "grade-3",
    title: "Grade 3 Mathematics",
    shortTitle: "Grade 3",
    category: "elementary",
    focus: "Multiplication, division, fractions, area, and data",
    readinessLabel: "Core operations",
    summary:
      "A pivotal year for multiplication, division, fraction meaning, measurement, geometry, and multi-step reasoning.",
    bestFor: [
      "Students currently in Grade 3",
      "Grade 2 students ready to advance",
      "Grade 4 students rebuilding multiplication fluency",
    ],
    prerequisites: [
      "Place value to 1,000",
      "Addition and subtraction within 1,000",
      "Equal groups",
      "Halves and fourths",
      "Read picture and bar graphs",
    ],
    outcomes: [
      "Multiply and divide using facts and properties",
      "Represent and compare simple fractions",
      "Solve two-step word problems",
      "Find area and perimeter",
      "Measure time, mass, and volume and interpret data",
    ],
    nextLevel: "grade-4",
    nextDescription:
      "This level prepares students for larger multiplication and division, factors, fraction equivalence, decimals, and angle measurement.",
    units: [
      unit(
        "multiplication-division",
        "Multiplication and division",
        "Students connect equal groups, arrays, and inverse operations.",
        "Equal groups and repeated addition",
        [
          "Multiplication and division",
          "Multiplication facts and strategies",
          "Fact families and unknown factors",
        ],
      ),
      unit(
        "place-value-rounding",
        "Place value and whole-number operations",
        "Rounding and efficient operation strategies strengthen number sense with larger values.",
        "Place value to 1,000",
        [
          "Place value and rounding",
          "Multi-digit addition and subtraction",
          "Estimate to check reasonableness",
        ],
      ),
      unit(
        "fractions",
        "Fractions as numbers",
        "Number lines and area models help fractions become values students can reason about.",
        "Fractions as equal parts",
        ["Fractions as numbers", "Fraction comparison", "Equivalent fractions with visual models"],
      ),
      unit(
        "area-perimeter",
        "Area and perimeter",
        "Students distinguish the space inside a shape from the distance around it.",
        "Multiplication facts",
        ["Area and perimeter", "Tile rectangles and use formulas", "Find missing side lengths"],
      ),
      unit(
        "measurement-data",
        "Measurement and data",
        "Elapsed time, mass, volume, and graphs become tools for multi-step questions.",
        "Measure length and read clocks",
        ["Time, mass, and volume", "Graphs and data", "Read scaled picture and bar graphs"],
      ),
      unit(
        "reasoning-geometry",
        "Problem solving and geometry",
        "Students classify shapes and choose operations to solve connected situations.",
        "One-step operation problems",
        [
          "Two-step word problems",
          "Geometry and shape classification",
          "Explain a solution with equations and words",
        ],
      ),
    ],
  },
  {
    id: "grade-4",
    title: "Grade 4 Mathematics",
    shortTitle: "Grade 4",
    category: "elementary",
    focus: "Multi-digit operations, fractions, decimals, angles, and geometry",
    readinessLabel: "Deepen reasoning",
    summary:
      "Students extend whole-number operations and build the fraction, decimal, and geometry concepts needed for upper elementary math.",
    bestFor: [
      "Students currently in Grade 4",
      "Grade 3 students ready for challenge",
      "Grade 5 students filling fraction or division gaps",
    ],
    prerequisites: [
      "Multiplication facts",
      "Three-digit addition and subtraction",
      "Basic fraction meaning",
      "Area and perimeter",
      "Classify common shapes",
    ],
    outcomes: [
      "Use place value with multi-digit numbers",
      "Multiply larger numbers and divide with remainders",
      "Compare, combine, and find equivalent fractions",
      "Connect fractions and decimals",
      "Measure angles and reason about lines and symmetry",
    ],
    nextLevel: "grade-5",
    nextDescription:
      "This level prepares students for decimal operations, fraction multiplication, long division, volume, coordinate graphs, and numerical expressions.",
    units: [
      unit(
        "place-value-operations",
        "Multi-digit place value and operations",
        "Students use place-value structure to calculate accurately and estimate intelligently.",
        "Place value through 1,000",
        [
          "Multi-digit place value",
          "Multi-digit addition and subtraction",
          "Multi-step word problems",
        ],
      ),
      unit(
        "multiplication-division",
        "Multiplication and division",
        "Models lead into reliable written methods for larger products and quotients.",
        "Multiplication facts",
        [
          "Multiplication with larger numbers",
          "Division with remainders",
          "Interpret remainders in context",
        ],
      ),
      unit(
        "factors-multiples",
        "Factors, multiples, and patterns",
        "Students study number structure as preparation for fraction work and algebra.",
        "Multiplication and division facts",
        ["Factors and multiples", "Prime and composite numbers", "Generate and analyze patterns"],
      ),
      unit(
        "fraction-equivalence",
        "Fraction equivalence and comparison",
        "Visual and numerical strategies show when fractions name the same amount.",
        "Fractions as numbers",
        ["Equivalent fractions", "Fraction comparison", "Common denominators with models"],
      ),
      unit(
        "fraction-operations",
        "Fraction operations and decimals",
        "Students combine like-unit fractions and connect tenths and hundredths to decimal notation.",
        "Equivalent fractions",
        [
          "Adding and subtracting fractions",
          "Decimal foundations",
          "Compare decimals to hundredths",
        ],
      ),
      unit(
        "measurement-geometry",
        "Angles, measurement, and geometry",
        "Precise drawing and classification build spatial reasoning.",
        "Area, perimeter, and basic shapes",
        ["Angles and measurement", "Area and perimeter", "Lines, symmetry, and geometry"],
      ),
    ],
  },
  {
    id: "grade-5",
    title: "Grade 5 Mathematics",
    shortTitle: "Grade 5",
    category: "elementary",
    focus: "Fractions, decimals, volume, and coordinate graphs",
    readinessLabel: "Upper elementary",
    summary:
      "A structured path through number operations, fractions, geometry, measurement, and mathematical reasoning.",
    bestFor: [
      "Students currently in Grade 5",
      "Grade 4 students ready to move ahead",
      "Grade 6 students rebuilding missing foundations",
    ],
    prerequisites: [
      "Multiplication facts",
      "Basic fraction equivalence",
      "Multi-digit addition and subtraction",
      "Area and perimeter",
      "Reading simple graphs",
    ],
    outcomes: [
      "Solve multi-step problems using all four operations",
      "Work confidently with fractions and decimals",
      "Understand volume and coordinate graphs",
      "Explain mathematical reasoning clearly",
      "Recognize when an answer is reasonable",
      "Prepare for ratios and early algebra",
    ],
    nextLevel: "grade-6",
    nextDescription:
      "This level prepares students for ratios, negative numbers, expressions, and early equations.",
    units: [
      unit(
        "decimal-place-value",
        "Place value and decimal operations",
        "Students extend place-value understanding to thousandths and calculate with decimals in practical contexts.",
        "Whole-number place value and decimal foundations",
        ["Decimal place value", "Decimal operations", "Estimate and check decimal results"],
      ),
      unit(
        "whole-number-operations",
        "Multi-digit multiplication and division",
        "Efficient written strategies make larger calculations accurate and explainable.",
        "Multiplication facts and division with remainders",
        ["Multi-digit multiplication", "Long division", "Interpret quotients and remainders"],
      ),
      unit(
        "fraction-operations",
        "Fraction operations",
        "Visual models connect common denominators, multiplication, and division to the meaning of fractions.",
        "Equivalent fractions and multiplication facts",
        [
          "Fraction addition and subtraction",
          "Fraction multiplication and division concepts",
          "Interpret fractions as division",
          "Solve real-world fraction problems",
        ],
      ),
      unit(
        "expressions-patterns",
        "Expressions, patterns, and relationships",
        "Students write, evaluate, and compare numerical ideas as a bridge into algebra.",
        "Order of operations with whole numbers",
        ["Numerical expressions", "Patterns and relationships", "Use parentheses and brackets"],
      ),
      unit(
        "measurement-volume",
        "Measurement and volume",
        "Students build and use volume formulas while keeping units and estimates meaningful.",
        "Area and multiplication",
        ["Volume", "Volume of rectangular prisms", "Convert measurements within one system"],
      ),
      unit(
        "coordinate-geometry",
        "Coordinate plane and geometry",
        "Graphing and classification organize spatial relationships with mathematical precision.",
        "Read simple graphs and classify shapes",
        [
          "Coordinate plane",
          "Geometry classification",
          "Graph and interpret points in the first quadrant",
        ],
      ),
      unit(
        "problem-solving",
        "Multi-step problem solving",
        "Students decide which information and operations matter, then communicate a defensible solution.",
        "Fluency with whole numbers, fractions, and decimals",
        [
          "Multi-step problem solving",
          "Explain solutions using visual models",
          "Check whether an answer is reasonable",
        ],
      ),
    ],
  },
  {
    id: "grade-6",
    title: "Grade 6 Mathematics",
    shortTitle: "Grade 6",
    category: "middle",
    focus: "Ratios, negative numbers, equations, geometry, and statistics",
    readinessLabel: "Middle school",
    summary:
      "Students connect arithmetic to ratios, signed numbers, algebraic expressions, equations, geometry, statistics, and real-world models.",
    bestFor: [
      "Students currently in Grade 6",
      "Grade 5 students ready for early algebra",
      "Grade 7 students repairing fraction or ratio gaps",
    ],
    prerequisites: [
      "Fraction and decimal fluency",
      "All four whole-number operations",
      "Coordinate graphs",
      "Volume",
      "Numerical expressions",
    ],
    outcomes: [
      "Reason with ratios, rates, and percents",
      "Operate with fractions, decimals, and negative numbers",
      "Write and solve simple equations and inequalities",
      "Find area, surface area, and volume",
      "Describe statistical center and variability",
    ],
    nextLevel: "grade-7",
    nextDescription:
      "This level prepares students for proportional relationships, rational-number fluency, multi-step equations, probability, and geometric scale.",
    units: [
      unit(
        "ratios-rates",
        "Ratios, unit rates, and percents",
        "Students compare quantities multiplicatively and apply rates to real decisions.",
        "Fraction multiplication and division",
        ["Ratios and unit rates", "Percent foundations", "Real-world modeling"],
      ),
      unit(
        "number-system",
        "The rational number system",
        "Fractions, decimals, and signed values become one connected number system.",
        "Fraction and decimal operations",
        ["Fractions and decimal operations", "Negative numbers", "Absolute value"],
      ),
      unit(
        "expressions",
        "Expressions and algebraic thinking",
        "Students translate words into expressions and use properties to reveal structure.",
        "Numerical expressions",
        ["Expressions", "Equivalent expressions", "Distributive property"],
      ),
      unit(
        "equations-inequalities",
        "Equations and inequalities",
        "Balance models and number lines make one-variable relationships visible.",
        "Evaluate expressions",
        ["One-variable equations", "Inequalities", "Represent solution sets on a number line"],
      ),
      unit(
        "coordinate-geometry",
        "Coordinate and spatial reasoning",
        "Coordinate graphs and nets connect two-dimensional measures to three-dimensional objects.",
        "Coordinate plane and area",
        ["Coordinate plane", "Area, surface area, and volume", "Polygons in all four quadrants"],
      ),
      unit(
        "statistics",
        "Statistics and distributions",
        "Students summarize data while noticing both a typical value and its spread.",
        "Read and create graphs",
        [
          "Statistical distributions",
          "Mean, median, and variability",
          "Choose an appropriate data display",
        ],
      ),
    ],
  },
  {
    id: "grade-7",
    title: "Grade 7 Mathematics",
    shortTitle: "Grade 7",
    category: "middle",
    focus: "Proportions, rational numbers, equations, geometry, and probability",
    readinessLabel: "Pre-algebra bridge",
    summary:
      "A rigorous bridge from ratio reasoning to proportional models, rational-number operations, equations, geometry, probability, and statistics.",
    bestFor: [
      "Students currently in Grade 7",
      "Grade 6 students ready to accelerate",
      "Grade 8 students rebuilding equation fluency",
    ],
    prerequisites: [
      "Ratios and unit rates",
      "Fraction and decimal operations",
      "Simple equations",
      "Area and volume",
      "Mean and median",
    ],
    outcomes: [
      "Model and solve proportional and percent situations",
      "Calculate fluently with rational numbers",
      "Solve multi-step equations and inequalities",
      "Reason with scale, circles, area, and volume",
      "Use probability and samples to make predictions",
    ],
    nextLevel: "grade-8",
    nextDescription:
      "This level prepares students for linear functions, systems, exponents, transformations, the Pythagorean theorem, and Algebra I.",
    units: [
      unit(
        "proportions-percent",
        "Proportional relationships and percents",
        "Tables, equations, and graphs show constant relationships in everyday contexts.",
        "Ratios and unit rates",
        ["Proportional relationships", "Percent applications", "Real-world problem solving"],
      ),
      unit(
        "rational-numbers",
        "Rational number operations",
        "Students operate with positive and negative fractions and decimals with meaning and accuracy.",
        "Negative numbers and fraction fluency",
        [
          "Rational number operations",
          "Apply properties of operations",
          "Multi-step numerical problems",
        ],
      ),
      unit(
        "expressions-equations",
        "Expressions, equations, and inequalities",
        "Algebraic structure supports reliable solutions to increasingly complex relationships.",
        "One-variable equations",
        ["Expressions and equations", "Multi-step equations", "Inequalities"],
      ),
      unit(
        "scale-geometry",
        "Scale and geometric construction",
        "Students reproduce figures, reason about angles, and use scale to connect drawings with reality.",
        "Proportional reasoning and angle basics",
        ["Scale drawings", "Geometry constructions", "Angle relationships"],
      ),
      unit(
        "circles-solids",
        "Circles, surface area, and volume",
        "Formulas are developed and applied, rather than memorized in isolation.",
        "Area and volume",
        ["Circles", "Surface area and volume", "Composite figures"],
      ),
      unit(
        "probability-statistics",
        "Probability, sampling, and statistics",
        "Students use random processes and samples to make careful claims about larger groups.",
        "Fractions, percents, and data displays",
        ["Probability", "Sampling and statistics", "Compare populations with data"],
      ),
    ],
  },
  {
    id: "grade-8",
    title: "Grade 8 Mathematics",
    shortTitle: "Grade 8",
    category: "middle",
    focus: "Linear relationships, functions, transformations, and exponents",
    readinessLabel: "Algebra transition",
    summary:
      "Students make the transition to formal algebra through linear relationships, functions, systems, exponents, geometry, and data.",
    bestFor: [
      "Students currently in Grade 8",
      "Grade 7 students on an accelerated path",
      "Algebra I students strengthening linear foundations",
    ],
    prerequisites: [
      "Proportional relationships",
      "Rational-number operations",
      "Multi-step equations",
      "Coordinate plane",
      "Angle and area relationships",
    ],
    outcomes: [
      "Solve and graph linear equations and systems",
      "Interpret slope and functions in context",
      "Apply exponent rules and scientific notation",
      "Use transformations and the Pythagorean theorem",
      "Analyze associations in bivariate data",
    ],
    nextLevel: "pre-algebra",
    nextDescription:
      "Students who need consolidation can enter Pre-Algebra; students demonstrating readiness can move directly into Algebra I.",
    units: [
      unit(
        "linear-equations",
        "Linear equations and systems",
        "Students solve equations with variables on both sides and connect solutions to line intersections.",
        "Multi-step one-variable equations",
        ["Linear equations", "Systems of equations", "Preparation for Algebra I"],
      ),
      unit(
        "functions",
        "Functions and linear relationships",
        "Multiple representations reveal how one quantity changes with another.",
        "Proportional graphs",
        ["Functions", "Slope and rate of change", "Graphing linear relationships"],
      ),
      unit(
        "exponents-numbers",
        "Exponents and real numbers",
        "Exponent rules and irrational values extend students beyond the rational number system.",
        "Integer operations and square roots",
        [
          "Exponents and scientific notation",
          "Irrational numbers",
          "Approximate roots on a number line",
        ],
      ),
      unit(
        "pythagorean",
        "Pythagorean theorem and volume",
        "Students connect square areas, distance, and three-dimensional measurement.",
        "Squares, roots, area, and volume",
        ["Pythagorean theorem", "Volume", "Distance in the coordinate plane"],
      ),
      unit(
        "transformations",
        "Transformations, similarity, and congruence",
        "Motion-based geometry makes relationships between figures precise.",
        "Coordinate plane and angle relationships",
        ["Transformations", "Similarity and congruence", "Angle relationships in parallel lines"],
      ),
      unit(
        "bivariate-data",
        "Data relationships",
        "Scatter plots help students describe and cautiously interpret associations.",
        "Coordinate graphing and statistics",
        ["Scatter plots and data relationships", "Lines of best fit", "Two-way tables"],
      ),
    ],
  },
  {
    id: "pre-algebra",
    title: "Pre-Algebra",
    shortTitle: "Pre-Algebra",
    category: "middle",
    focus: "Number fluency, equations, graphing, functions, and algebra readiness",
    readinessLabel: "Algebra readiness",
    summary:
      "A focused readiness course that consolidates arithmetic and turns it into flexible algebraic reasoning.",
    bestFor: [
      "Students preparing for Algebra I",
      "Middle school students needing a consolidated algebra bridge",
      "Students returning to algebra after a gap",
    ],
    prerequisites: [
      "Whole-number operations",
      "Fraction and decimal basics",
      "Ratios",
      "Simple equations",
      "Coordinate-plane basics",
    ],
    outcomes: [
      "Operate fluently with integers and rational numbers",
      "Solve multi-step equations and inequalities",
      "Graph relationships and recognize functions",
      "Use exponents and foundational radicals",
      "Apply algebra across geometry, statistics, and probability",
    ],
    nextLevel: "algebra-1",
    nextDescription:
      "This course prepares students to study linear, exponential, and quadratic relationships formally in Algebra I.",
    units: [
      unit(
        "number-fluency",
        "Number fluency and proportional reasoning",
        "Students close arithmetic gaps before those gaps can hide inside algebra.",
        "Fraction and decimal basics",
        [
          "Integer and rational number fluency",
          "Ratios, proportions, and percents",
          "Algebra readiness problem solving",
        ],
      ),
      unit(
        "expressions",
        "Algebraic expressions",
        "Variables, properties, and equivalent forms become a precise language for patterns.",
        "Order of operations",
        ["Algebraic expressions", "Distributive property", "Combine like terms"],
      ),
      unit(
        "equations-inequalities",
        "Equations and inequalities",
        "Students solve, check, and interpret multi-step relationships.",
        "One-step equations",
        ["Multi-step equations", "Inequalities", "Word problems with unknown quantities"],
      ),
      unit(
        "graphing-functions",
        "Graphing and function foundations",
        "Tables, rules, and coordinate graphs describe how quantities relate.",
        "Coordinate-plane basics",
        ["Graphing", "Functions foundations", "Slope as a rate of change"],
      ),
      unit(
        "exponents-radicals",
        "Exponents and radical foundations",
        "Powers and roots are connected as inverse ways of describing number structure.",
        "Multiplication and factor fluency",
        ["Exponents", "Radicals foundations", "Scientific notation review"],
      ),
      unit(
        "applications",
        "Geometry, statistics, and probability review",
        "Core applications give algebra a practical and visual setting.",
        "Area, volume, and data basics",
        ["Geometry review", "Statistics and probability", "Multi-step application problems"],
      ),
    ],
  },
  {
    id: "algebra-1",
    title: "Algebra I",
    shortTitle: "Algebra I",
    category: "high",
    focus: "Equations, functions, inequalities, and modeling",
    readinessLabel: "Core high school",
    summary:
      "A complete first algebra course built around structure, representations, functions, and modeling—not isolated symbol rules.",
    bestFor: [
      "Students enrolled in Algebra I",
      "Advanced middle school students",
      "Geometry students reviewing algebra foundations",
    ],
    prerequisites: [
      "Rational-number fluency",
      "Ratios and percents",
      "Multi-step equations",
      "Coordinate graphing",
      "Exponent basics",
    ],
    outcomes: [
      "Solve equations, inequalities, and systems",
      "Interpret and compare linear and exponential functions",
      "Operate with and factor polynomials",
      "Solve and graph quadratic relationships",
      "Model data and real situations with functions",
    ],
    nextLevel: "geometry",
    nextDescription:
      "Algebra I provides the coordinate, equation, and reasoning tools used throughout Geometry and later Algebra II.",
    units: [
      unit(
        "structure-equations",
        "Algebraic structure and equations",
        "Students use properties and equivalence to transform expressions and solve relationships.",
        "Pre-Algebra fluency",
        [
          "Expressions and algebraic structure",
          "Linear equations",
          "Mathematical modeling and applications",
        ],
      ),
      unit(
        "inequalities-systems",
        "Inequalities and systems",
        "Graphing shows how one or several constraints shape possible solutions.",
        "Linear equations and coordinate graphs",
        ["Linear inequalities", "Systems of equations", "Systems of inequalities"],
      ),
      unit(
        "functions-linear",
        "Functions and linear models",
        "Function notation, graphs, and equations describe constant rates of change.",
        "Coordinate graphing and variables",
        ["Functions and function notation", "Linear functions", "Data modeling"],
      ),
      unit(
        "exponentials-sequences",
        "Exponential functions and sequences",
        "Repeated multiplication is connected to growth, decay, and patterned lists.",
        "Exponent rules",
        ["Exponential functions", "Sequences", "Compare linear and exponential change"],
      ),
      unit(
        "polynomials",
        "Polynomial operations and factoring",
        "Students reveal polynomial structure by combining, multiplying, and factoring expressions.",
        "Distributive property and exponents",
        ["Polynomial operations", "Factoring", "Special products"],
      ),
      unit(
        "quadratics-radicals",
        "Quadratics and radicals",
        "Multiple solution methods connect quadratic equations, functions, and graphs.",
        "Polynomial operations",
        ["Quadratic equations", "Quadratic functions", "Radical expressions"],
      ),
    ],
  },
  {
    id: "geometry",
    title: "Geometry",
    shortTitle: "Geometry",
    category: "high",
    focus: "Proof, transformations, triangles, circles, and spatial reasoning",
    readinessLabel: "Reason and prove",
    summary:
      "A visual and logical study of transformations, proof, similarity, trigonometry, circles, coordinate methods, and measurement.",
    bestFor: [
      "Students enrolled in high school Geometry",
      "Algebra I students ready for spatial reasoning",
      "Algebra II students rebuilding proof or trigonometry foundations",
    ],
    prerequisites: [
      "Linear equations",
      "Coordinate graphing",
      "Solve proportions",
      "Square roots",
      "Basic angle relationships",
    ],
    outcomes: [
      "Build formal arguments from definitions and theorems",
      "Use transformations to establish congruence and similarity",
      "Solve right-triangle and coordinate problems",
      "Reason about circles, area, and volume",
      "Apply geometry in constructions and probability",
    ],
    nextLevel: "algebra-2",
    nextDescription:
      "Geometry strengthens proof, coordinate reasoning, and trigonometric foundations needed for Algebra II and Precalculus.",
    units: [
      unit(
        "proof-logic",
        "Proof, logic, lines, and angles",
        "Students learn how definitions, diagrams, and justified steps create a reliable argument.",
        "Algebraic reasoning and basic angle facts",
        [
          "Foundations of proof",
          "Logic and reasoning",
          "Lines and angles",
          "Formal mathematical argument",
        ],
      ),
      unit(
        "transformations-congruence",
        "Transformations and congruence",
        "Rigid motions explain why figures preserve size and shape.",
        "Coordinate plane",
        ["Transformations", "Triangle congruence", "Geometric constructions"],
      ),
      unit(
        "similarity-polygons",
        "Similarity and polygons",
        "Proportional reasoning unlocks indirect measurement and relationships within figures.",
        "Proportions and congruence",
        ["Triangle similarity", "Polygons", "Probability applications"],
      ),
      unit(
        "coordinate-geometry",
        "Coordinate geometry",
        "Algebraic tools verify geometric relationships on a plane.",
        "Linear equations and distance",
        ["Coordinate geometry", "Slope, midpoint, and distance", "Coordinate proofs"],
      ),
      unit(
        "right-triangles",
        "Right triangles and trigonometry",
        "Side-length relationships connect the Pythagorean theorem to angle-based ratios.",
        "Square roots and similar triangles",
        ["Right triangles", "Trigonometric ratios", "Solve applied triangle problems"],
      ),
      unit(
        "circles-measurement",
        "Circles, area, and volume",
        "Students connect equations, theorems, and formulas to curved and three-dimensional figures.",
        "Similarity and algebraic substitution",
        ["Circles", "Area and volume", "Arc, chord, tangent, and sector relationships"],
      ),
    ],
  },
  {
    id: "algebra-2",
    title: "Algebra II",
    shortTitle: "Algebra II",
    category: "high",
    focus: "Advanced functions, complex numbers, logarithms, and modeling",
    readinessLabel: "Advanced algebra",
    summary:
      "Students extend algebra into a connected study of polynomial, rational, radical, exponential, logarithmic, and statistical models.",
    bestFor: [
      "Students enrolled in Algebra II",
      "Geometry students on an accelerated sequence",
      "Precalculus students repairing function gaps",
    ],
    prerequisites: [
      "Linear functions and systems",
      "Factoring",
      "Quadratic equations",
      "Exponent rules",
      "Function notation",
    ],
    outcomes: [
      "Analyze and transform major function families",
      "Solve advanced equations and systems",
      "Work with complex numbers and polynomial structure",
      "Use exponential and logarithmic models",
      "Apply sequences, probability, statistics, and conics",
    ],
    nextLevel: "precalculus",
    nextDescription:
      "Algebra II prepares students to synthesize advanced function behavior with trigonometry, vectors, polar forms, and introductory limits.",
    units: [
      unit(
        "linear-quadratic",
        "Advanced linear systems and quadratics",
        "Students revisit familiar forms with deeper analysis and more complex solution methods.",
        "Algebra I linear and quadratic fluency",
        ["Advanced linear equations and systems", "Quadratic functions", "Complex numbers"],
      ),
      unit(
        "polynomials",
        "Polynomial functions",
        "Zeros, graphs, operations, and division reveal how polynomial structure controls behavior.",
        "Factoring and quadratic functions",
        [
          "Polynomial functions",
          "Polynomial division",
          "Fundamental theorem of algebra applications",
        ],
      ),
      unit(
        "rational-radical",
        "Rational and radical relationships",
        "Students track domains, extraneous solutions, and transformations across non-polynomial forms.",
        "Polynomial and radical fluency",
        ["Rational expressions", "Rational equations", "Radical functions"],
      ),
      unit(
        "exponential-logarithmic",
        "Exponential and logarithmic functions",
        "Inverse relationships make growth, decay, scales, and compound change understandable.",
        "Exponent rules and inverse functions",
        ["Exponential functions", "Logarithmic functions", "Mathematical modeling"],
      ),
      unit(
        "sequences-conics",
        "Sequences, series, and conic sections",
        "Patterns and geometric loci connect discrete and visual models.",
        "Functions and coordinate geometry",
        ["Sequences and series", "Conic sections", "Arithmetic and geometric series"],
      ),
      unit(
        "transformations-statistics",
        "Function transformations, probability, and statistics",
        "Students compare models, transform their graphs, and quantify uncertainty.",
        "Function notation and basic statistics",
        ["Function transformations", "Probability and statistics", "Choose and evaluate a model"],
      ),
    ],
  },
  {
    id: "precalculus",
    title: "Precalculus",
    shortTitle: "Precalculus",
    category: "high",
    focus: "Advanced functions, trigonometry, and preparation for calculus",
    readinessLabel: "Calculus preparation",
    summary:
      "An integrated study of advanced functions, trigonometry, analytic geometry, alternate coordinate systems, vectors, sequences, and limits.",
    bestFor: [
      "Students enrolled in Precalculus",
      "Algebra II students ready to advance",
      "Calculus students reinforcing function and trigonometry foundations",
    ],
    prerequisites: [
      "Polynomial and rational functions",
      "Exponential and logarithmic equations",
      "Right-triangle trigonometry",
      "Complex numbers",
      "Sequences",
    ],
    outcomes: [
      "Analyze and transform advanced functions",
      "Use the unit circle and trigonometric identities fluently",
      "Solve triangles and trigonometric equations",
      "Work with conics, vectors, polar, and parametric forms",
      "Understand the intuitive purpose of a limit",
    ],
    units: [
      unit(
        "function-analysis",
        "Advanced function analysis",
        "Students connect algebraic form, domain, range, inverse behavior, transformations, and graphs.",
        "Algebra II function fluency",
        ["Advanced function analysis", "Function transformations", "Preparation for calculus"],
      ),
      unit(
        "polynomial-rational",
        "Polynomial, rational, exponential, and logarithmic functions",
        "Major function families are compared by their structure, behavior, and modeling uses.",
        "Polynomial operations and logarithms",
        [
          "Polynomial and rational functions",
          "Exponential and logarithmic functions",
          "End behavior and asymptotes",
        ],
      ),
      unit(
        "trigonometric-functions",
        "Trigonometric functions and the unit circle",
        "Circular motion and coordinates extend trigonometry beyond right triangles.",
        "Right-triangle trigonometric ratios",
        ["Trigonometric functions", "Unit circle", "Graph periodic behavior"],
      ),
      unit(
        "identities-equations",
        "Trigonometric identities and equations",
        "Students use equivalent forms to prove relationships and solve periodic equations.",
        "Unit-circle fluency",
        ["Trigonometric identities", "Trigonometric equations", "Law of sines and cosines"],
      ),
      unit(
        "analytic-geometry",
        "Analytic geometry and conic sections",
        "Equations and geometric definitions describe curves in multiple coordinate systems.",
        "Coordinate geometry and quadratic forms",
        ["Analytic geometry", "Conic sections", "Parametric equations", "Polar coordinates"],
      ),
      unit(
        "vectors-sequences-limits",
        "Vectors, sequences, and introductory limits",
        "Direction, discrete change, and approaching behavior create a conceptual bridge into calculus.",
        "Trigonometry and sequences",
        ["Vectors", "Sequences and series", "Introductory limits"],
      ),
    ],
  },
];

export const curriculumById = new Map(mathematicsCurriculum.map((level) => [level.id, level]));

export const curriculumGroups = [
  { id: "elementary", label: "Elementary school" },
  { id: "middle", label: "Middle school" },
  { id: "high", label: "High school" },
] as const;

export const journeyMilestoneIds = [
  "grade-1",
  "grade-3",
  "grade-5",
  "pre-algebra",
  "algebra-1",
  "geometry",
  "algebra-2",
  "precalculus",
] as const;

export const defaultCurriculumLevel = "grade-5";
