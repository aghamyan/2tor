import type { Locale } from "@app/i18n/config";

export type HowItWorksCopy = typeof en;

const en = {
  hero: {
    eyebrow: "How 2tor works",
    /*
     * "learn" is doing two jobs in one sentence — the school learns, and the student learns — and
     * the reader has to disambiguate mid-headline. "know" says the same thing in one meaning. The
     * Armemian translation already read this way ("we know the student, and only then plan the
     * lesson"), so this brings the English in line with it rather than the other way round.
     */
    title: "We know the student before we plan the lesson.",
    /* The claim is the ORDER, not the knowing — plenty of tutors know their students. */
    titleAccent: "before we plan the lesson.",
    body: "2tor records what your child knows, where they struggle, what they are learning at school, and what should come next.",
    /*
     * Three points, not the paragraph that used to sit here. That sentence restated the lede above
     * it — both said "we keep a record and it helps" — and a second block of prose under a headline
     * this large read as filler. As labelled points they name three distinct outcomes and scan in
     * one pass, matching the home hero's differentiator row.
     */
    outcomes: ["Better-prepared lessons", "Visible parent updates", "Accurate group matching"],
    primary: "Book a free consultation",
    secondaryCta: "See the learning system",
    note: "Start with a short conversation. No long enrollment form.",
    trust: [
      "Structured student learning record",
      "Verified subject tutors",
      "Parent-visible progress",
      "US-curriculum familiarity",
    ],
  },
  profile: {
    label: "Example learning profile",
    student: "Aram · Grade 6 Mathematics",
    record: "Learning Record",
    signals: [
      ["School grade", "Grade 6"],
      ["Current topic", "Fractions"],
      ["Strong skill", "Equivalent fractions"],
      ["Developing skill", "Common denominators"],
      ["Recent homework", "82%"],
      ["Tutor observation", "Visual models help"],
      ["Goal", "Ratios and expressions"],
      ["Schedule", "Weekday evenings"],
    ],
    outputs: ["Structured lesson plan", "Parent update", "Group match possibility"],
  },
  evidence: {
    eyebrow: "The shared thread",
    title: "One student. One evolving learning record.",
    titleAccent: "One evolving learning record.",
    body: "Every lesson, homework submission, tutor note, and assessment adds useful evidence.",
    items: [
      "School learning",
      "Initial assessment",
      "Live lessons",
      "Homework",
      "Tutor feedback",
      "Progress review",
      "Updated plan",
    ],
  },
  understand: {
    eyebrow: "01 · Understand",
    title: "We start with what the student actually knows.",
    titleAccent: "actually knows.",
    body: "Grade level is useful, but it is not enough. Two students in the same grade may need completely different support.",
    /*
 * "label" made this sound like the objection is to categorising children at all, which is not the
 * claim — the claim is that age and grade are not enough information to plan from. Stated as what
 * we do instead, it also connects directly to the heading above it ("we start with what the student
 * actually knows") rather than restating it in the negative.
 */
    note: "Age and school grade alone do not tell us where to start.",
    categories: [
      {
        title: "Knows confidently",
        tone: "mastered",
        skills: [
          [
            "Multiplication facts",
            "Placement assessment",
            "Accurate and fluent",
            "Use fluency in multi-step problems",
          ],
          [
            "Equivalent fractions",
            "Schoolwork",
            "Explains with visual models",
            "Connect models to symbolic notation",
          ],
          [
            "Reading bar graphs",
            "Homework",
            "Independent across recent work",
            "Apply to two-step questions",
          ],
        ],
      },
      {
        title: "Developing",
        tone: "developing",
        skills: [
          [
            "Unlike denominators",
            "Tutor observation",
            "Needs a visual prompt",
            "Build a common unit first",
          ],
          [
            "Multi-step word problems",
            "Homework",
            "Chooses one operation reliably",
            "Plan and check a second step",
          ],
          [
            "Ratio language",
            "Parent input",
            "New topic at school",
            "Connect words, tables, and diagrams",
          ],
        ],
      },
      {
        title: "Missing foundation",
        tone: "support",
        skills: [
          [
            "Fraction multiplication",
            "Placement assessment",
            "Procedure is not yet secure",
            "Rebuild meaning before procedure",
          ],
          [
            "Unit-rate reasoning",
            "Schoolwork",
            "Confuses rate and total",
            "Compare quantities in tables",
          ],
        ],
      },
    ],
    details: ["Evidence source", "Recent observation", "Recommended next step"],
  },
  record: {
    eyebrow: "02 · Record",
    title: "The learning record grows with every class.",
    titleAccent: "with every class.",
    feed: [
      "Lesson attended",
      "Skill practised",
      "Homework submitted",
      "Tutor feedback added",
      "Assessment reviewed",
      "Goal updated",
    ],
    tabs: [
      {
        label: "Knowledge",
        title: "Current knowledge",
        stats: [
          ["Current level", "Grade 6 · Fractions"],
          ["Mastered", "12 recorded skills"],
          ["Developing", "3 active skills"],
          ["Next milestone", "Add unlike denominators"],
        ],
      },
      {
        label: "Lessons",
        title: "Lesson continuity",
        stats: [
          ["Attended", "6 of 6"],
          ["Latest focus", "Visual fraction models"],
          ["Participation", "Consistent"],
          ["Next lesson", "Symbolic steps"],
        ],
      },
      {
        label: "Homework",
        title: "Practice evidence",
        stats: [
          ["Latest result", "82%"],
          ["Completed", "On schedule"],
          ["Pattern", "Models are strongest"],
          ["Review next", "Denominator choice"],
        ],
      },
      {
        label: "Feedback",
        title: "Tutor observations",
        stats: [
          ["Strength", "Explains thinking"],
          ["Support", "Needs visual start"],
          ["School link", "Fractions unit"],
          ["Next note", "Check independence"],
        ],
      },
      {
        label: "Progress",
        title: "Progress over time",
        stats: [
          ["Active goal", "Reliable fraction addition"],
          ["Evidence", "Lessons + homework"],
          ["Attendance", "100% example"],
          ["Plan status", "On track"],
        ],
      },
    ],
    privacy: "Example content. Real records are visible only to authorized users.",
  },
  prepare: {
    eyebrow: "03 · Prepare",
    title: "The tutor does not start from zero every week.",
    titleAccent: "from zero every week.",
    body: "Before class, the tutor can see the previous lesson, current goals, weak points, assigned homework, and recommended next step.",
    objective:
      "Add fractions with unlike denominators using visual models, then move to symbolic steps.",
    inputs: [
      ["Student summary", "Grade 6 · visual learner"],
      ["Last feedback", "Models improved confidence"],
      ["Practice needed", "Common denominators"],
      ["School topic", "Fraction operations"],
      ["Homework", "82% · review Q4"],
      ["Prepared materials", "Fraction bars + challenge set"],
    ],
    without: [
      "Repeat diagnostic questions",
      "Relearn the student’s history",
      "Disconnected worksheets",
      "Generic preparation",
    ],
    with: [
      "Clear starting point",
      "Evidence-based goal",
      "Relevant examples",
      "Continuity between lessons",
    ],
  },
  teach: {
    eyebrow: "04 · Teach",
    title: "A clear lesson, adjusted in real time.",
    titleAccent: "adjusted in real time.",
    flow: [
      "Quick check-in",
      "Review",
      "New concept",
      "Guided example",
      "Student practice",
      "Challenge",
      "Next step",
    ],
    goal: "Today’s goal",
    goalValue: "Add fractions using a common unit",
    tutor: "Tutor explanation",
    student: "Student response",
    confidence: "Confidence check",
    notes: "Notes captured for feedback",
  },
  between: {
    eyebrow: "05 · Continue",
    title: "Learning should not disappear when the call ends.",
    titleAccent: "when the call ends.",
    body: "The platform keeps the work, feedback, and next steps in one place.",
    center: "Completed lesson",
    items: [
      "Homework",
      "Practice resources",
      "Tutor feedback",
      "Learning questions",
      "Parent summary",
      "Next class preparation",
    ],
    note: "Students can submit questions and review tutor responses through the platform.",
  },
  parents: {
    eyebrow: "06 · Inform",
    title: "Parents see the progress without becoming the tutor.",
    titleAccent: "without becoming the tutor.",
    body: "Parents stay involved in major decisions while tutors manage day-to-day instruction.",
    cta: "Explore the parent experience",
    fields: [
      ["Lesson topic", "Adding unlike fractions"],
      ["Attendance", "Attended"],
      ["Homework", "Submitted"],
      ["Current goal", "Reliable fraction addition"],
      ["Skills developing", "Common denominators"],
      ["Latest feedback", "Visual models are helping"],
      ["Next lesson", "Tuesday · 6:00 PM"],
      ["Plan update", "Move to symbols next"],
    ],
  },
  match: {
    eyebrow: "07 · Match",
    title: "Knowing the student helps us build better groups.",
    titleAccent: "build better groups.",
    body: "Group lessons work only when students have compatible levels, topics, goals, and schedules.",
    students: [
      ["Student A", "Grade 6 mathematics", "Fractions · at grade level", "Weekday evenings"],
      ["Student B", "Grade 6 mathematics", "Fractions · building confidence", "Weekday evenings"],
      ["Student C", "Grade 6 mathematics", "Multiplication foundation gaps", "Weekend mornings"],
    ],
    compatible: "A + B may be compatible",
    wait: "C is not placed in this group yet",
    labels: [
      "Similar topic",
      "Compatible readiness",
      "Shared schedule",
      "Different foundation needs",
    ],
    explanation: "This is why a suitable group may take time to form.",
    benefits: [
      "Lower shared cost",
      "Peer discussion",
      "Shared motivation",
      "Learning network",
      "Small-group attention",
    ],
    cta: "Explore group lessons",
  },
  verify: {
    eyebrow: "Qualified support",
    title: "We do not simply connect you with an available tutor.",
    titleAccent: "an available tutor.",
    stages: [
      ["Application", "Teaching experience and subject fit"],
      ["Identity review", "Identity information is checked"],
      ["Qualification review", "Relevant degrees and qualifications are reviewed"],
      ["Subject evaluation", "Knowledge of planned subjects and levels"],
      ["Curriculum readiness", "Relevant US grade expectations when applicable"],
      ["Platform training", "Feedback, homework, and record keeping"],
      ["Approved tutor", "Ready to work inside the learning system"],
    ],
    policy:
      "We prioritize tutors with at least a bachelor’s degree in a relevant field and verify qualifications before approval.",
    profile: [
      ["Subject", "Mathematics"],
      ["Supported grades", "Middle school"],
      ["Degree field", "Relevant field reviewed"],
      ["Languages", "Shown on approved profile"],
      ["Status", "Qualifications reviewed"],
      ["Approach", "Visual to symbolic reasoning"],
    ],
    sample: "Illustrative tutor profile",
  },
  system: {
    title: "More than tutoring software. More than a tutor directory.",
    titleAccent: "More than a tutor directory.",
    roles: [
      ["Student", "Work · Questions · Assessments · Participation"],
      ["Tutor", "Lesson notes · Feedback · Homework · Observations"],
      ["Parent", "Goals · School context · Schedule · Decisions"],
      [
        "2tor learning system",
        "Learning record · Curriculum path · Progress visibility · Matching information · Organized communication",
      ],
    ],
  },
  logic: {
    eyebrow: "Plain-language learning logic",
    title: "We make the learning process understandable.",
    titleAccent: "understandable.",
    body: "You can see why a topic is being taught, what evidence shows progress, and what should happen next.",
    items: [
      [
        "Why this topic?",
        "Common denominators are needed before fraction addition can become reliable.",
      ],
      [
        "How do we know progress happened?",
        "The student solved visual and symbolic examples independently across two lessons.",
      ],
      ["What comes next?", "Move from fraction procedures into ratio reasoning."],
    ],
  },
  curriculum: {
    title: "A structured curriculum, personalized to the student.",
    titleAccent: "personalized to the student.",
    curriculum: [
      "Sequence",
      "Grade expectations",
      "Prerequisites",
      "Learning outcomes",
      "Progress milestones",
    ],
    personalized: [
      "Starting point",
      "Lesson pace",
      "Example difficulty",
      "Practice amount",
      "Review frequency",
      "Homework",
      "Learning format",
    ],
    note: "Personalization should not mean random lessons. Structure and adaptation work together.",
  },
  overview: {
    title: "From first conversation to measurable next steps",
    titleAccent: "measurable next steps",
    items: [
      ["Parent consultation", "final-cta"],
      ["Student-level review", "understand"],
      ["Tutor and format selection", "verify"],
      ["Learning plan", "prepare"],
      ["Live lesson", "teach"],
      ["Homework and feedback", "continue"],
      ["Progress update", "inform"],
      ["Plan adjustment", "record"],
    ],
  },
  final: {
    title: "Start with a clearer picture of what your child needs.",
    titleAccent: "a clearer picture",
    body: "Tell us what is going well, what feels difficult, and what your family hopes to achieve.",
    primary: "Book a free consultation",
    secondary: "Explore subjects",
    note: "No long enrollment form. We start with a short conversation.",
  },
  common: {
    example: "Illustrative example",
    curriculum: "Curriculum provides",
    personalization: "Personalization adjusts",
    without: "Without a shared record",
    with: "With 2tor",
    lessonObjective: "Prepared lesson objective",
    parentView: "Parent view",
  },
};

const hy: HowItWorksCopy = {
  ...en,
  hero: {
    eyebrow: "Ինչպես է աշխատում 2tor-ը",
    title: "Մենք ճանաչում ենք սովորողին, հետո միայն պլանավորում դասը։",
    titleAccent: "հետո միայն պլանավորում դասը։",
    body: "2tor-ը գրանցում է՝ ինչ գիտի ձեր երեխան, որտեղ է դժվարանում, ինչ է սովորում դպրոցում և որն է հաջորդ քայլը։",
    outcomes: ["Ավելի լավ պատրաստված դասեր", "Ծնողին տեսանելի ընթացք", "Ճշգրիտ խմբավորում"],
    primary: "Ամրագրել անվճար խորհրդատվություն",
    secondaryCta: "Տեսնել ուսուցման համակարգը",
    note: "Սկսեք կարճ զրույցից՝ առանց երկար գրանցման ձևի։",
    trust: [
      "Կառուցվածքային ուսումնական գրառում",
      "Ստուգված առարկայական դասավանդողներ",
      "Ծնողին տեսանելի առաջընթաց",
      "ԱՄՆ ծրագրի իմացություն",
    ],
  },
  evidence: {
    eyebrow: "Ընդհանուր թել",
    title: "Մեկ սովորող։ Մեկ զարգացող ուսումնական գրառում։",
    titleAccent: "Մեկ զարգացող ուսումնական գրառում։",
    body: "Յուրաքանչյուր դաս, տնային աշխատանք, դասավանդողի նշում և գնահատում ավելացնում է օգտակար փաստեր։",
    items: [
      "Դպրոցական ուսուցում",
      "Նախնական գնահատում",
      "Ուղիղ դասեր",
      "Տնային աշխատանք",
      "Դասավանդողի արձագանք",
      "Առաջընթացի դիտարկում",
      "Թարմացված պլան",
    ],
  },
  understand: {
    ...en.understand,
    eyebrow: "01 · Հասկանալ",
    title: "Սկսում ենք նրանից, թե սովորողն իրականում ինչ գիտի։",
    titleAccent: "իրականում ինչ գիտի։",
    body: "Դասարանը կարևոր է, բայց բավարար չէ։ Նույն դասարանի երկու սովորողի կարող է պետք լինել բոլորովին տարբեր աջակցություն։",
    note: "Տարիքը և դասարանը միայնակ չեն ասում, թե որտեղից սկսել։",
  },
  record: {
    ...en.record,
    eyebrow: "02 · Գրանցել",
    title: "Ուսումնական գրառումն աճում է յուրաքանչյուր դասի հետ։",
    titleAccent: "յուրաքանչյուր դասի հետ։",
    privacy:
      "Օրինակային բովանդակություն։ Իրական գրառումները տեսանելի են միայն լիազորված օգտվողներին։",
  },
  prepare: {
    ...en.prepare,
    eyebrow: "03 · Պատրաստվել",
    title: "Դասավանդողը ամեն շաբաթ զրոյից չի սկսում։",
    titleAccent: "զրոյից չի սկսում։",
    body: "Դասից առաջ դասավանդողը տեսնում է նախորդ դասը, նպատակները, դժվարությունները, տնային աշխատանքը և հաջորդ առաջարկվող քայլը։",
  },
  teach: { ...en.teach, eyebrow: "04 · Դասավանդել", title: "Հստակ դաս՝ ընթացքին հարմարեցված։" },
  between: {
    ...en.between,
    eyebrow: "05 · Շարունակել",
    title: "Ուսուցումը չպետք է ավարտվի զանգի հետ։",
    titleAccent: "զանգի հետ։",
    body: "Հարթակը մեկ տեղում պահում է աշխատանքը, արձագանքը և հաջորդ քայլերը։",
    note: "Սովորողները կարող են հարցեր ուղարկել և հարթակում դիտել դասավանդողի պատասխանները։",
  },
  parents: {
    ...en.parents,
    eyebrow: "06 · Տեղեկացնել",
    title: "Ծնողը տեսնում է առաջընթացը՝ առանց դասավանդող դառնալու։",
    titleAccent: "առանց դասավանդող դառնալու։",
    body: "Ծնողները մասնակցում են կարևոր որոշումներին, իսկ դասավանդողները վարում են ամենօրյա ուսուցումը։",
    cta: "Ծանոթանալ ծնողի փորձին",
  },
  match: {
    ...en.match,
    eyebrow: "07 · Համադրել",
    title: "Սովորողին ճանաչելը օգնում է ավելի ճիշտ խմբեր կազմել։",
    titleAccent: "ավելի ճիշտ խմբեր կազմել։",
    body: "Խմբային դասերն աշխատում են, երբ համատեղելի են մակարդակը, թեման, նպատակը և ժամանակացույցը։",
    compatible: "A + B կարող են համատեղելի լինել",
    wait: "C-ն դեռ չի ընդգրկվում այս խմբում",
    explanation: "Ահա թե ինչու հարմար խումբ ձևավորելը կարող է ժամանակ պահանջել։",
    cta: "Ուսումնասիրել խմբային դասերը",
  },
  verify: {
    ...en.verify,
    eyebrow: "Որակյալ աջակցություն",
    title: "Մենք պարզապես չենք միացնում ձեզ ազատ դասավանդողի հետ։",
    titleAccent: "ազատ դասավանդողի հետ։",
    policy:
      "Մենք առաջնահերթություն ենք տալիս համապատասխան ոլորտում առնվազն բակալավրի աստիճան ունեցող դասավանդողներին և հաստատում ենք որակավորումները մինչև ընդունումը։",
    sample: "Դասավանդողի պատկերավոր պրոֆիլ",
  },
  system: { ...en.system, title: "Ավելին, քան ուսուցման ծրագիր։ Ավելին, քան դասավանդողների ցանկ։" },
  logic: {
    ...en.logic,
    eyebrow: "Ուսուցման տրամաբանությունը՝ պարզ լեզվով",
    title: "Մենք ուսուցման ընթացքը դարձնում ենք հասկանալի։",
    titleAccent: "հասկանալի։",
    body: "Դուք տեսնում եք՝ ինչու է թեման ուսուցանվում, ինչ փաստ է ցույց տալիս առաջընթացը և որն է հաջորդ քայլը։",
  },
  curriculum: {
    ...en.curriculum,
    title: "Կառուցվածքային ծրագիր՝ հարմարեցված սովորողին։",
    titleAccent: "հարմարեցված սովորողին։",
    note: "Անհատականացումը պատահական դասեր չի նշանակում։ Կառուցվածքն ու հարմարեցումը գործում են միասին։",
  },
  overview: { ...en.overview, title: "Առաջին զրույցից մինչև չափելի հաջորդ քայլեր" },
  final: {
    title: "Սկսեք՝ ավելի հստակ հասկանալով, թե ինչ է պետք ձեր երեխային։",
    titleAccent: "ավելի հստակ հասկանալով",
    body: "Պատմեք՝ ինչն է լավ ընթանում, ինչն է դժվար և ինչի է ցանկանում հասնել ձեր ընտանիքը։",
    primary: "Ամրագրել անվճար խորհրդատվություն",
    secondary: "Ուսումնասիրել առարկաները",
    note: "Առանց երկար գրանցման ձևի։ Սկսում ենք կարճ զրույցից։",
  },
};

export function getHowItWorksCopy(locale: Locale): HowItWorksCopy {
  return locale === "hy" ? hy : en;
}
