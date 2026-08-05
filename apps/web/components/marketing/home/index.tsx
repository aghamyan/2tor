import { Noto_Sans_Armenian, Plus_Jakarta_Sans } from "next/font/google";
import type { Locale } from "@app/i18n/config";
import { localHref } from "./content";
import {
  LearningBenefits,
  SubjectExplorer,
  type BenefitsCopy,
  type ClassroomCopy,
  type SubjectCopy,
} from "./compact-home";
import { Hero } from "./hero";
import styles from "./compact-home.module.css";

const displayFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--home-font-display",
});

const bodyFont = Noto_Sans_Armenian({
  subsets: ["armenian", "latin"],
  weight: "variable",
  display: "swap",
  variable: "--home-font-body",
});

interface HomeCopy {
  hero: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    description: string;
    primary: string;
    secondary: string;
    trust: readonly string[];
    socialProof: string;
  };
  classroom: ClassroomCopy;
  subjects: Omit<SubjectCopy, "items"> & {
    items: readonly Omit<SubjectCopy["items"][number], "href">[];
  };
  benefits: BenefitsCopy;
}

const copy: Record<Locale, HomeCopy> = {
  en: {
    hero: {
      eyebrow: "Personal online learning",
      titleLead: "Big goals start with",
      titleAccent: "one good lesson.",
      description:
        "Live, personalized classes with tutors who notice where your child gets stuck, adapt in real time, and keep parents informed after every lesson.",
      primary: "Find my tutor",
      secondary: "Take a free assessment",
      trust: [
        "Verified expert tutors",
        "Parent-visible progress",
        "US-aligned curriculum",
        "Safe by design",
      ],
      socialProof: "Trusted by families learning across the US",
    },
    classroom: {
      ariaLabel:
        "Interactive 2tor classroom preview showing a live algebra lesson and parent progress tools",
      live: "Live lesson",
      lesson: "Algebra: Visual equations",
      tutor: "Anna · Today at 4:00 PM",
      topic: "Visual equations",
      prompt: "Balance both sides",
      feedback: "Tutor feedback",
      feedbackBody: "Maya explained why the equation stays balanced.",
      parentReady: "Parent summary ready",
      wins: "3 learning wins this week",
      confidence: "Confidence improved by 18%",
      streak: "4 week streak",
      homework: "Mini project",
      homeworkStatus: "Equation explorer · Complete",
    },
    subjects: {
      eyebrow: "Find the right starting point",
      title: "Explore a subject",
      hint: "Swipe to explore",
      items: [
        {
          key: "math",
          name: "Mathematics",
          description: "Build confidence through visual problem solving",
        },
        {
          key: "armenian",
          name: "Armenian Heritage",
          description: "Language, culture, and heritage",
        },
      ],
      comingSoon: {
        badge: "Coming soon",
        title: "More subjects on the way",
        description: "New subjects are added regularly.",
      },
    },
    benefits: {
      eyebrow: "The complete learning loop",
      title: "Everything around the lesson matters.",
      description:
        "A good class creates momentum. 2tor carries that momentum from the live explanation to the parent update and the next practice session.",
      items: [
        {
          key: "adaptive",
          signal: "During class",
          title: "Adaptive live teaching",
          body: "Tutors adjust explanations as soon as a student gets stuck.",
        },
        {
          key: "parents",
          signal: "After every lesson",
          title: "Parent-visible progress",
          body: "Parents receive clear feedback and can track results after every class.",
        },
        {
          key: "practice",
          signal: "Between classes",
          title: "Practice that continues after class",
          body: "Homework, projects, and weekly problem-solving sessions reinforce learning.",
        },
      ],
    },
  },
  hy: {
    hero: {
      eyebrow: "Անհատական առցանց ուսուցում",
      titleLead: "Մեծ նպատակները սկսվում են",
      titleAccent: "մեկ լավ դասից։",
      description:
        "Անհատական ուղիղ դասեր ուսուցիչների հետ, որոնք նկատում են դժվարությունը, անմիջապես փոխում բացատրությունը և յուրաքանչյուր դասից հետո տեղեկացնում ծնողներին։",
      primary: "Գտնել իմ ուսուցչին",
      secondary: "Անցնել անվճար գնահատում",
      trust: [
        "Ստուգված մասնագետներ",
        "Ծնողին տեսանելի առաջընթաց",
        "ԱՄՆ ծրագրին համապատասխան",
        "Անվտանգ միջավայր",
      ],
      socialProof: "ԱՄՆ-ում սովորող ընտանիքների վստահելի ընտրությունը",
    },
    classroom: {
      ariaLabel:
        "2tor-ի ինտերակտիվ դասասենյակի օրինակ՝ հանրահաշվի ուղիղ դասով և առաջընթացի գործիքներով",
      live: "Ուղիղ դաս",
      lesson: "Հանրահաշիվ․ տեսողական հավասարումներ",
      tutor: "Աննա · Այսօր՝ 16։00",
      topic: "Տեսողական հավասարումներ",
      prompt: "Հավասարակշռիր երկու կողմերը",
      feedback: "Ուսուցչի արձագանք",
      feedbackBody: "Մայան բացատրեց, թե ինչու է հավասարումը մնում հավասարակշռված։",
      parentReady: "Ծնողի ամփոփումը պատրաստ է",
      wins: "3 ուսումնական հաջողություն այս շաբաթ",
      confidence: "Վստահությունն աճել է 18%-ով",
      streak: "4 շաբաթ անընդմեջ",
      homework: "Փոքր նախագիծ",
      homeworkStatus: "Հավասարումների հետազոտող · Ավարտված",
    },
    subjects: {
      eyebrow: "Գտեք ճիշտ մեկնարկը",
      title: "Ընտրեք առարկան",
      hint: "Սահեցրեք՝ տեսնելու համար",
      items: [
        {
          key: "math",
          name: "Մաթեմատիկա",
          description: "Վստահություն՝ տեսողական խնդիրների միջոցով",
        },
        {
          key: "armenian",
          name: "Հայոց ժառանգություն",
          description: "Լեզու, մշակույթ և ժառանգություն",
        },
      ],
      comingSoon: {
        badge: "Շուտով",
        title: "Ավելի շատ առարկաներ՝ ճանապարհին",
        description: "Նոր առարկաներ պարբերաբար ավելացվում են։",
      },
    },
    benefits: {
      eyebrow: "Ուսուցման ամբողջական շղթա",
      title: "Դասի շուրջ ամեն ինչ կարևոր է։",
      description:
        "Լավ դասը շարժում է ստեղծում։ 2tor-ը պահպանում է այն բացատրությունից մինչև ծնողի ամփոփում և հաջորդ վարժանք։",
      items: [
        {
          key: "adaptive",
          signal: "Դասի ընթացքում",
          title: "Հարմարվող ուղիղ ուսուցում",
          body: "Ուսուցիչները փոխում են բացատրությունը հենց որ սովորողը դժվարանում է։",
        },
        {
          key: "parents",
          signal: "Յուրաքանչյուր դասից հետո",
          title: "Ծնողին տեսանելի առաջընթաց",
          body: "Ծնողները ստանում են հստակ արձագանք և հետևում արդյունքներին։",
        },
        {
          key: "practice",
          signal: "Դասերի միջև",
          title: "Շարունակվող վարժանք",
          body: "Տնային աշխատանքը, նախագծերը և շաբաթական հանդիպումները ամրապնդում են գիտելիքը։",
        },
      ],
    },
  },
};

const subjectPaths: Record<HomeCopy["subjects"]["items"][number]["key"], string> = {
  math: "/mathematics",
  armenian: "/armenian-language-heritage",
};

export function HomePageContent({ locale }: { locale: Locale }) {
  const content = copy[locale];
  const subjects: SubjectCopy = {
    ...content.subjects,
    items: content.subjects.items.map((item) => ({
      ...item,
      href: localHref(locale, subjectPaths[item.key]),
    })),
  };

  return (
    <div className={`${styles.page} ${displayFont.variable} ${bodyFont.variable}`}>
      <Hero
        eyebrow={content.hero.eyebrow}
        titleLead={content.hero.titleLead}
        titleAccent={content.hero.titleAccent}
        description={content.hero.description}
        primaryCta={{ label: content.hero.primary, href: "#courses" }}
        secondaryCta={{
          label: content.hero.secondary,
          href: localHref(locale, "/free-assessment"),
        }}
        trust={content.hero.trust}
        socialProof={content.hero.socialProof}
        classroom={content.classroom}
      />
      <SubjectExplorer copy={subjects} />
      <LearningBenefits copy={content.benefits} />
    </div>
  );
}
