import type { Locale } from "@app/i18n/config";

export interface PremiumHomeCopy {
  navigation: {
    label: string;
    system: string;
    subjects: string;
    process: string;
    faq: string;
    start: string;
  };
  hero: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    description: string;
    primary: string;
    secondary: string;
    proof: string;
  };
  trust: { label: string; items: readonly string[] };
  why: {
    eyebrow: string;
    title: string;
    description: string;
    principles: readonly { title: string; body: string }[];
  };
  story: { eyebrow: string; title: string; description: string };
  features: readonly {
    key: "curriculum" | "feedback" | "dashboard" | "tutors" | "groups" | "weekly";
    label: string;
    title: string;
    body: string;
    points: readonly string[];
  }[];
  goals: {
    eyebrow: string;
    title: string;
    description: string;
    items: readonly {
      title: string;
      label: string;
      plan: string;
      detail: string;
    }[];
  };
  capabilities: {
    eyebrow: string;
    title: string;
    items: readonly { key: string; title: string; body: string }[];
  };
  subjects: {
    eyebrow: string;
    title: string;
    description: string;
    math: { label: string; title: string; body: string; tags: readonly string[]; cta: string };
    heritage: {
      label: string;
      title: string;
      body: string;
      tags: readonly string[];
      cta: string;
    };
  };
  process: {
    eyebrow: string;
    title: string;
    description: string;
    steps: readonly { title: string; body: string }[];
  };
  testimonials: {
    eyebrow: string;
    title: string;
    disclosure: string;
    items: readonly { quote: string; attribution: string; result: string }[];
  };
  faq: {
    eyebrow: string;
    title: string;
    items: readonly { question: string; answer: string }[];
  };
  final: { eyebrow: string; title: string; body: string; primary: string; secondary: string };
  ui: {
    learningRecord: string;
    live: string;
    currentTerm: string;
    progress: string;
    lessonComplete: string;
    feedbackReady: string;
    homework: string;
    submitted: string;
    nextSession: string;
    verifiedTutor: string;
    degree: string;
    experience: string;
    attendance: string;
    strengths: string;
    improvement: string;
    mastered: string;
    inProgress: string;
    weeklyClinic: string;
    freeIncluded: string;
    selectedPlan: string;
    viewPlan: string;
    sample: string;
  };
}

const en: PremiumHomeCopy = {
  navigation: {
    label: "Explore 2tor",
    system: "The system",
    subjects: "Subjects",
    process: "How it works",
    faq: "Questions",
    start: "Start learning",
  },
  hero: {
    eyebrow: "A complete learning system for grades 3–12",
    titleLead: "More than tutoring.",
    titleAccent: "A system you can see.",
    description:
      "Structured lessons, exceptional tutors, and a live parent view of every milestone—so progress never feels like a promise.",
    primary: "Start learning",
    secondary: "See how it works",
    proof: "Free consultation · No commitment · Parent-visible by design",
  },
  trust: {
    label: "Designed around the questions parents ask first",
    items: [
      "US-aligned curriculum",
      "Verified subject experts",
      "Feedback after every lesson",
      "Free weekly problem-solving session",
    ],
  },
  why: {
    eyebrow: "The 2tor difference",
    title: "A great lesson matters. What happens around it matters more.",
    description:
      "We connect curriculum, teaching, practice, and parent visibility into one continuous learning record.",
    principles: [
      {
        title: "Planned, not improvised",
        body: "Every lesson advances a clear, standards-aligned path.",
      },
      {
        title: "Visible, not vague",
        body: "Parents see the work, feedback, attendance, and growth.",
      },
      {
        title: "Supported, not solo",
        body: "Students get help between lessons—not only during them.",
      },
    ],
  },
  story: {
    eyebrow: "One connected system",
    title: "Every scroll is one less thing you have to wonder about.",
    description:
      "Follow a lesson from the curriculum plan to the parent update—and see how each layer compounds.",
  },
  features: [
    {
      key: "curriculum",
      label: "Structured US curriculum",
      title: "No random lessons. Every concept has a next step.",
      body: "A carefully sequenced curriculum aligned with US standards gives students the right challenge at the right time.",
      points: ["Standards mapped", "Milestone based", "Adapts to performance"],
    },
    {
      key: "feedback",
      label: "Feedback after every lesson",
      title: "Class ends. Clarity arrives.",
      body: "Parents receive a concise record of what was taught, homework, attendance, strengths, and what needs attention.",
      points: ["Teacher comments", "Homework assigned", "Attendance recorded"],
    },
    {
      key: "dashboard",
      label: "Parent dashboard",
      title: "See the whole learning story—not a stack of invoices.",
      body: "Progress trends, test results, milestones, weak topics, and learning pace live in one calm, useful view.",
      points: ["Monthly improvement", "Skill mastery", "Achievement history"],
    },
    {
      key: "tutors",
      label: "Verified tutors",
      title: "Exceptional educators, carefully selected.",
      body: "Every tutor is interviewed, background checked, teaching-evaluated, university educated, and a genuine subject expert.",
      points: ["Identity verified", "Degree reviewed", "Teaching evaluated"],
    },
    {
      key: "groups",
      label: "Small group classes",
      title: "More voices. More energy. A lower cost.",
      body: "Purposefully small groups make learning collaborative and interactive while staying significantly more affordable than private lessons.",
      points: ["Maximum 4 students", "Matched by level", "Collaborative practice"],
    },
    {
      key: "weekly",
      label: "Free weekly problem solving",
      title: "Students never have to stay stuck.",
      body: "Every learner gets an additional one-hour weekly session for homework, questions, review, and difficult topics—at no extra cost.",
      points: ["Every Friday", "One full hour", "Included free"],
    },
  ],
  goals: {
    eyebrow: "Choose your goal",
    title: "Start with the outcome. We’ll build the path.",
    description: "Select what your child needs now to preview how the learning system adapts.",
    items: [
      {
        title: "Build long-term academic success",
        label: "Long-term curriculum",
        plan: "A steady, standards-aligned path",
        detail:
          "Diagnostic baseline, weekly lessons, milestones, projects, and monthly progress reviews.",
      },
      {
        title: "Prepare for an upcoming exam",
        label: "Intensive exam plan",
        plan: "Ready—even when only 7 days remain",
        detail:
          "Rapid diagnostic, priority topics, focused study blocks, daily confidence checks, and tutor review.",
      },
      {
        title: "Get ahead of school",
        label: "Accelerated learning",
        plan: "Master what’s next, not only what’s due",
        detail:
          "A personalized sequence that advances strong topics while closing hidden knowledge gaps.",
      },
      {
        title: "Learn better together",
        label: "Affordable small groups",
        plan: "High interaction, shared momentum",
        detail:
          "Level-matched groups of up to four students with collaborative challenges and a lower price.",
      },
    ],
  },
  capabilities: {
    eyebrow: "Built for the moments between lessons",
    title: "Learning changes. The system changes with it.",
    items: [
      {
        key: "projects",
        title: "Real projects",
        body: "Blueprints become financial plans, data stories, and completed work.",
      },
      {
        key: "path",
        title: "Personalized path",
        body: "Quiz results and tutor feedback continuously reshape what comes next.",
      },
      {
        key: "exam",
        title: "Exam preparation",
        body: "A focused plan can launch immediately—even with one week remaining.",
      },
      {
        key: "homework",
        title: "Homework help",
        body: "Questions are captured, organized, and solved in dedicated sessions.",
      },
      {
        key: "confidence",
        title: "Beyond grades",
        body: "Critical thinking, confidence, discipline, and independence grow together.",
      },
      {
        key: "flexible",
        title: "Flexible learning",
        body: "Private, group, intensive, or long-term—all within one learning record.",
      },
    ],
  },
  subjects: {
    eyebrow: "Subjects",
    title: "Two focused programs. One uncompromising standard.",
    description:
      "We are intentionally focused today, so every curriculum, tutor, and parent report can be exceptional.",
    math: {
      label: "US curriculum · Grades 3–12",
      title: "Mathematics",
      body: "From number sense to advanced algebra—conceptual understanding, fluent practice, and real-world application.",
      tags: ["Foundations", "Algebra", "Geometry", "Data"],
      cta: "Explore mathematics",
    },
    heritage: {
      label: "Language · History · Identity",
      title: "Armenian Heritage",
      body: "A living connection to Armenian language, culture, and history—taught with academic structure and cultural care.",
      tags: ["Reading", "Speaking", "History", "Culture"],
      cta: "Explore Armenian heritage",
    },
  },
  process: {
    eyebrow: "How it works",
    title: "From first conversation to visible progress.",
    description: "A simple beginning. A rigorous system behind it.",
    steps: [
      { title: "Choose a course", body: "Tell us the goal, schedule, and current level." },
      { title: "Meet the right tutor", body: "We match for expertise, teaching style, and pace." },
      {
        title: "Follow the plan",
        body: "Lessons, feedback, practice, and support stay connected.",
      },
      {
        title: "See the results",
        body: "Track milestones, confidence, and progress in one place.",
      },
    ],
  },
  testimonials: {
    eyebrow: "The parent perspective",
    title: "The first result is clarity.",
    disclosure:
      "Illustrative examples. Real family stories are published only with verified consent and never identify a child.",
    items: [
      {
        quote:
          "We finally understand what our child is learning, where the gaps are, and what happens next.",
        attribution: "Parent of a mathematics learner",
        result: "A clear plan after week one",
      },
      {
        quote:
          "The feedback is specific enough that we can support at home without managing every lesson.",
        attribution: "Parent of an Armenian Heritage learner",
        result: "Feedback after every class",
      },
    ],
  },
  faq: {
    eyebrow: "Questions, answered",
    title: "Everything parents ask before the first lesson.",
    items: [
      {
        question: "How are tutors verified?",
        answer:
          "We verify identity and education, run background checks, interview every candidate, and evaluate a real teaching sample before a tutor can work with students.",
      },
      {
        question: "What can I see in the parent dashboard?",
        answer:
          "Attendance, homework, lesson feedback, teacher comments, milestones, skills, assessment results, achievements, and progress trends—all organized by learner.",
      },
      {
        question: "Are group classes matched by age or level?",
        answer:
          "Both. We keep groups small and match students by academic level, learning goal, and age compatibility so participation stays productive.",
      },
      {
        question: "Is the weekly problem-solving session really free?",
        answer:
          "Yes. Every enrolled student receives one additional one-hour weekly session for homework, review, and difficult questions at no extra cost.",
      },
      {
        question: "Can you help if an exam is only a week away?",
        answer:
          "Yes. We can launch a rapid diagnostic and intensive seven-day plan that prioritizes the highest-impact topics and daily practice.",
      },
    ],
  },
  final: {
    eyebrow: "A better way to learn",
    title: "Give your child a plan—and yourself a clear view of the progress.",
    body: "Start with a free conversation. We’ll learn where your child is today and show you the path forward.",
    primary: "Start learning",
    secondary: "Book a free assessment",
  },
  ui: {
    learningRecord: "Maya’s learning record",
    live: "Live",
    currentTerm: "Current term",
    progress: "Overall progress",
    lessonComplete: "Lesson completed",
    feedbackReady: "Parent feedback is ready",
    homework: "Homework",
    submitted: "Submitted",
    nextSession: "Next session",
    verifiedTutor: "Verified tutor",
    degree: "M.Ed. · Columbia University",
    experience: "8 years experience",
    attendance: "Attendance",
    strengths: "Strengths",
    improvement: "Needs attention",
    mastered: "Mastered",
    inProgress: "In progress",
    weeklyClinic: "Weekly problem-solving",
    freeIncluded: "Free · Included",
    selectedPlan: "Your learning path",
    viewPlan: "View this plan",
    sample: "Illustrative preview",
  },
};

const hy: PremiumHomeCopy = {
  ...en,
  navigation: {
    label: "Բացահայտեք 2tor-ը",
    system: "Համակարգը",
    subjects: "Առարկաներ",
    process: "Ինչպես է աշխատում",
    faq: "Հարցեր",
    start: "Սկսել ուսուցումը",
  },
  hero: {
    eyebrow: "Ամբողջական ուսուցման համակարգ՝ 3–12-րդ դասարանների համար",
    titleLead: "Ավելին, քան պարապմունք։",
    titleAccent: "Համակարգ, որը տեսանելի է։",
    description:
      "Կառուցվածքային դասեր, բացառիկ մանկավարժներ և յուրաքանչյուր հանգրվանի ծնողական տեսանելիություն։",
    primary: "Սկսել ուսուցումը",
    secondary: "Տեսնել՝ ինչպես է աշխատում",
    proof: "Անվճար խորհրդատվություն · Առանց պարտավորության · Տեսանելի ծնողի համար",
  },
  trust: {
    label: "Ստեղծված է ծնողների առաջին հարցերի շուրջ",
    items: [
      "ԱՄՆ չափորոշիչներին համապատասխան ծրագիր",
      "Ստուգված մասնագետներ",
      "Հետադարձ կապ՝ ամեն դասից հետո",
      "Անվճար շաբաթական խնդրալուծում",
    ],
  },
  why: {
    eyebrow: "2tor-ի տարբերությունը",
    title: "Լավ դասը կարևոր է։ Դրա շուրջ կառուցված համակարգը՝ առավել ևս։",
    description:
      "Մենք միավորում ենք ծրագիրը, դասավանդումը, վարժանքը և ծնողական տեսանելիությունը մեկ շարունակական ուսուցման գրանցամատյանում։",
    principles: [
      {
        title: "Պլանավորված, ոչ պատահական",
        body: "Յուրաքանչյուր դաս առաջ է տանում չափորոշիչներին համապատասխան հստակ ուղին։",
      },
      { title: "Տեսանելի, ոչ անորոշ", body: "Ծնողները տեսնում են աշխատանքը, հետադարձ կապը և աճը։" },
      { title: "Աջակցված, ոչ միայնակ", body: "Սովորողները օգնություն են ստանում նաև դասերի միջև։" },
    ],
  },
  story: {
    eyebrow: "Մեկ միասնական համակարգ",
    title: "Յուրաքանչյուր քայլ պատասխանում է ևս մեկ ծնողական հարցի։",
    description:
      "Հետևեք դասին՝ ուսումնական պլանից մինչև ծնողի հաշվետվություն, և տեսեք՝ ինչպես են բոլոր շերտերն աշխատում միասին։",
  },
  features: [
    {
      ...en.features[0],
      key: "curriculum",
      label: "Կառուցվածքային ԱՄՆ ծրագիր",
      title: "Ոչ մի պատահական դաս։ Յուրաքանչյուր գաղափար ունի հաջորդ քայլ։",
      body: "ԱՄՆ չափորոշիչներին համապատասխան հետևողական ծրագիրը ճիշտ պահին տալիս է ճիշտ բարդությունը։",
      points: ["Չափորոշիչների քարտեզ", "Հանգրվաններ", "Հարմարվում է արդյունքներին"],
    },
    {
      ...en.features[1],
      key: "feedback",
      label: "Հետադարձ կապ՝ ամեն դասից հետո",
      title: "Դասն ավարտվում է։ Պարզությունը՝ սկսվում։",
      body: "Ծնողը ստանում է ամփոփ գրառում՝ անցած նյութի, տնայինի, հաճախման, ուժեղ կողմերի և ուշադրության կետերի մասին։",
      points: ["Մանկավարժի մեկնաբանություն", "Տնային աշխատանք", "Հաճախում"],
    },
    {
      ...en.features[2],
      key: "dashboard",
      label: "Ծնողական վահանակ",
      title: "Տեսեք ուսուցման ամբողջ պատմությունը։",
      body: "Առաջընթացը, թեստերը, հանգրվանները, դժվար թեմաները և ուսուցման արագությունը՝ մեկ հանգիստ ու օգտակար տեսքում։",
      points: ["Ամսական աճ", "Հմտությունների յուրացում", "Ձեռքբերումներ"],
    },
    {
      ...en.features[3],
      key: "tutors",
      label: "Ստուգված մանկավարժներ",
      title: "Բացառիկ մանկավարժներ՝ խնամքով ընտրված։",
      body: "Յուրաքանչյուր մանկավարժ անցնում է հարցազրույց, ստուգում և դասավանդման գնահատում, ունի համալսարանական կրթություն։",
      points: ["Ինքնության ստուգում", "Դիպլոմի ստուգում", "Դասավանդման գնահատում"],
    },
    {
      ...en.features[4],
      key: "groups",
      label: "Փոքր խմբեր",
      title: "Ավելի շատ ներգրավում։ Ավելի մատչելի արժեք։",
      body: "Փոքր խմբերը ուսուցումը դարձնում են համագործակցային և զգալիորեն ավելի մատչելի, քան անհատական դասերը։",
      points: ["Մինչև 4 սովորող", "Համապատասխան մակարդակ", "Համատեղ վարժանք"],
    },
    {
      ...en.features[5],
      key: "weekly",
      label: "Անվճար շաբաթական խնդրալուծում",
      title: "Սովորողը երբեք մենակ չի մնում հարցի հետ։",
      body: "Յուրաքանչյուր սովորող ստանում է հավելյալ մեկժամյա շաբաթական հանդիպում՝ տնայինի, հարցերի և դժվար թեմաների համար։",
      points: ["Ամեն ուրբաթ", "Լրիվ մեկ ժամ", "Ներառված է անվճար"],
    },
  ],
  goals: {
    eyebrow: "Ընտրեք նպատակը",
    title: "Սկսեք արդյունքից։ Մենք կկառուցենք ուղին։",
    description: "Ընտրեք, թե ինչ է պետք ձեր երեխային հիմա, և տեսեք՝ ինչպես է համակարգը հարմարվում։",
    items: [
      {
        title: "Կառուցել երկարաժամկետ հաջողություն",
        label: "Երկարաժամկետ ծրագիր",
        plan: "Կայուն, չափորոշիչներին համապատասխան ուղի",
        detail: "Մուտքային գնահատում, շաբաթական դասեր, հանգրվաններ, նախագծեր և ամսական ամփոփում։",
      },
      {
        title: "Պատրաստվել մոտակա քննությանը",
        label: "Ինտենսիվ քննության ծրագիր",
        plan: "Պատրաստ՝ նույնիսկ 7 օրվա դեպքում",
        detail: "Արագ գնահատում, առաջնահերթ թեմաներ, ուսումնական բլոկներ և ամենօրյա ստուգում։",
      },
      {
        title: "Առաջ անցնել դպրոցական ծրագրից",
        label: "Արագացված ուսուցում",
        plan: "Յուրացնել հաջորդը, ոչ միայն ընթացիկը",
        detail: "Անհատական ուղի, որը զարգացնում է ուժեղ կողմերը և փակում թաքնված բացերը։",
      },
      {
        title: "Սովորել ավելի լավ՝ միասին",
        label: "Մատչելի փոքր խմբեր",
        plan: "Բարձր ներգրավում, ընդհանուր շարժում",
        detail: "Մինչև չորս սովորողից կազմված համադրելի խմբեր և ավելի մատչելի արժեք։",
      },
    ],
  },
  capabilities: {
    eyebrow: "Ստեղծված է նաև դասերի միջև պահերի համար",
    title: "Ուսուցումը փոխվում է։ Համակարգը՝ նույնպես։",
    items: [
      {
        key: "projects",
        title: "Իրական նախագծեր",
        body: "Գծագրերը դառնում են ֆինանսական պլաններ, տվյալների պատմություններ և ավարտված աշխատանք։",
      },
      {
        key: "path",
        title: "Անհատական ուղի",
        body: "Թեստերն ու մանկավարժի դիտարկումները շարունակաբար փոխում են հաջորդ քայլը։",
      },
      {
        key: "exam",
        title: "Քննության պատրաստում",
        body: "Կենտրոնացված ծրագիրը կարող է մեկնարկել անմիջապես՝ նույնիսկ մեկ շաբաթում։",
      },
      {
        key: "homework",
        title: "Տնայինի աջակցություն",
        body: "Հարցերը հավաքվում, դասավորվում և լուծվում են հատուկ հանդիպումներում։",
      },
      {
        key: "confidence",
        title: "Գնահատականից այն կողմ",
        body: "Քննադատական մտածողությունը, վստահությունն ու ինքնուրույնությունը զարգանում են միասին։",
      },
      {
        key: "flexible",
        title: "Ճկուն ուսուցում",
        body: "Անհատական, խմբային, ինտենսիվ կամ երկարաժամկետ՝ մեկ համակարգում։",
      },
    ],
  },
  subjects: {
    eyebrow: "Առարկաներ",
    title: "Երկու կենտրոնացած ծրագիր։ Մեկ բարձր չափանիշ։",
    description:
      "Մենք այսօր գիտակցաբար կենտրոնացած ենք, որպեսզի յուրաքանչյուր ծրագիր, մանկավարժ և հաշվետվություն լինի բացառիկ։",
    math: {
      label: "ԱՄՆ ծրագիր · 3–12-րդ դասարան",
      title: "Մաթեմատիկա",
      body: "Թվային մտածողությունից մինչև բարձրագույն հանրահաշիվ՝ խոր ըմբռնում, վարժանք և իրական կիրառություն։",
      tags: ["Հիմունքներ", "Հանրահաշիվ", "Երկրաչափություն", "Տվյալներ"],
      cta: "Բացել մաթեմատիկան",
    },
    heritage: {
      label: "Լեզու · Պատմություն · Ինքնություն",
      title: "Հայկական ժառանգություն",
      body: "Կենդանի կապ հայոց լեզվին, մշակույթին ու պատմությանը՝ ակադեմիական կառուցվածքով և հոգատարությամբ։",
      tags: ["Ընթերցում", "Խոսք", "Պատմություն", "Մշակույթ"],
      cta: "Բացել հայկական ժառանգությունը",
    },
  },
  process: {
    eyebrow: "Ինչպես է աշխատում",
    title: "Առաջին զրույցից մինչև տեսանելի առաջընթաց։",
    description: "Պարզ սկիզբ։ Խորը համակարգ՝ դրա հետևում։",
    steps: [
      { title: "Ընտրեք դասընթացը", body: "Պատմեք նպատակի, գրաֆիկի և ընթացիկ մակարդակի մասին։" },
      {
        title: "Հանդիպեք ճիշտ մանկավարժին",
        body: "Մենք համադրում ենք փորձը, ոճը և ուսուցման տեմպը։",
      },
      { title: "Հետևեք պլանին", body: "Դասերը, հետադարձ կապն ու աջակցությունը մնում են միացված։" },
      { title: "Տեսեք արդյունքը", body: "Հետևեք հանգրվաններին, վստահությանը և աճին մեկ տեղում։" },
    ],
  },
  testimonials: {
    eyebrow: "Ծնողի տեսանկյունը",
    title: "Առաջին արդյունքը պարզությունն է։",
    disclosure:
      "Պատկերազարդ օրինակներ։ Իրական պատմությունները հրապարակվում են միայն ստուգված համաձայնությամբ և առանց երեխային նույնականացնելու։",
    items: [
      {
        quote:
          "Վերջապես հասկանում ենք՝ ինչ է սովորում մեր երեխան, որտեղ են բացերը և որն է հաջորդ քայլը։",
        attribution: "Մաթեմատիկա սովորող երեխայի ծնող",
        result: "Հստակ պլան՝ առաջին շաբաթից",
      },
      {
        quote:
          "Հետադարձ կապն այնքան հստակ է, որ կարող ենք աջակցել տանը՝ առանց ամեն դասը վերահսկելու։",
        attribution: "Հայկական ժառանգության սովորողի ծնող",
        result: "Ամփոփում՝ ամեն դասից հետո",
      },
    ],
  },
  faq: {
    eyebrow: "Հարցեր և պատասխաններ",
    title: "Այն ամենը, ինչ ծնողները հարցնում են առաջին դասից առաջ։",
    items: [
      {
        question: "Ինչպե՞ս են ստուգվում մանկավարժները։",
        answer:
          "Մենք ստուգում ենք ինքնությունն ու կրթությունը, անցկացնում ենք նախապատմության ստուգում, հարցազրույց և իրական դասավանդման գնահատում։",
      },
      {
        question: "Ի՞նչ եմ տեսնում ծնողական վահանակում։",
        answer:
          "Հաճախում, տնային աշխատանք, դասի ամփոփում, մեկնաբանություններ, հանգրվաններ, թեստեր, ձեռքբերումներ և առաջընթացի միտումներ։",
      },
      {
        question: "Խմբերը կազմվո՞ւմ են տարիքով, թե մակարդակով։",
        answer:
          "Երկուսով էլ։ Խմբերը փոքր են և համադրվում են մակարդակով, նպատակով ու տարիքային համապատասխանությամբ։",
      },
      {
        question: "Շաբաթական խնդրալուծումն իսկապե՞ս անվճար է։",
        answer:
          "Այո։ Յուրաքանչյուր գրանցված սովորող ստանում է հավելյալ մեկժամյա շաբաթական հանդիպում՝ առանց լրացուցիչ վճարի։",
      },
      {
        question: "Կարո՞ղ եք օգնել, եթե քննությանը մեկ շաբաթ է մնացել։",
        answer:
          "Այո։ Կարող ենք անմիջապես մեկնարկել արագ գնահատում և յոթօրյա ինտենսիվ ծրագիր՝ կենտրոնանալով ամենակարևոր թեմաների վրա։",
      },
    ],
  },
  final: {
    eyebrow: "Սովորելու ավելի լավ ձև",
    title: "Տվեք ձեր երեխային պլան, իսկ ինքներդ ձեզ՝ առաջընթացի հստակ տեսք։",
    body: "Սկսեք անվճար զրույցից։ Մենք կհասկանանք երեխայի ներկա մակարդակը և ցույց կտանք առաջ գնալու ուղին։",
    primary: "Սկսել ուսուցումը",
    secondary: "Ամրագրել անվճար գնահատում",
  },
  ui: {
    learningRecord: "Մայայի ուսուցման գրանցամատյան",
    live: "Ուղիղ",
    currentTerm: "Ընթացիկ կիսամյակ",
    progress: "Ընդհանուր առաջընթաց",
    lessonComplete: "Դասն ավարտված է",
    feedbackReady: "Ծնողի ամփոփումը պատրաստ է",
    homework: "Տնային աշխատանք",
    submitted: "Հանձնված",
    nextSession: "Հաջորդ դասը",
    verifiedTutor: "Ստուգված մանկավարժ",
    degree: "M.Ed. · Columbia University",
    experience: "8 տարվա փորձ",
    attendance: "Հաճախում",
    strengths: "Ուժեղ կողմեր",
    improvement: "Ուշադրության կարիք ունի",
    mastered: "Յուրացված",
    inProgress: "Ընթացքում",
    weeklyClinic: "Շաբաթական խնդրալուծում",
    freeIncluded: "Անվճար · Ներառված է",
    selectedPlan: "Ձեր ուսուցման ուղին",
    viewPlan: "Բացել այս պլանը",
    sample: "Պատկերազարդ նախադիտում",
  },
};

export function premiumHomeCopy(locale: Locale): PremiumHomeCopy {
  return locale === "hy" ? hy : en;
}
