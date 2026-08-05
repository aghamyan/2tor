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

/*
 * The type stack is no longer declared here. Plus Jakarta Sans belonged to this page's own visual
 * identity; the public surfaces now share one stack (Instrument Sans / Atkinson Hyperlegible /
 * Noto Sans Armenian) loaded once in `app/(marketing)/layout.tsx` from `../fonts.ts`. Loading a
 * fourth family here would have shipped an extra font download for a page that no longer uses it.
 */
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
        "2tor classroom preview, cycling through a mathematics, Armenian, and chess lesson with parent progress tools",
      live: "Live lesson",
      wins: "3 learning wins this week",
      streak: "4 week streak",
      subjects: [
        {
          key: "math",
          label: "Mathematics",
          lesson: "Algebra: Visual equations",
          tutor: "Anna · Today at 4:00 PM",
          tutorInitial: "A",
          topic: "Visual equations",
          prompt: "Balance both sides",
          confidence: "Confidence improved by 18%",
          note: {
            author: "Anna Ghazaryan",
            initials: "AG",
            role: "Note after today's lesson",
            body: "Solid grasp of the method. Still slow when the denominators differ.",
            action: "10 practice problems",
            topic: "Fractions",
            status: "Summary sent to parents",
          },
        },
        {
          key: "armenian",
          label: "Armenian",
          lesson: "Armenian: Reading and writing",
          tutor: "Siranush · Today at 5:30 PM",
          tutorInitial: "Ս",
          topic: "The alphabet",
          prompt: "Sound out each letter",
          confidence: "Reading fluency improved by 22%",
          note: {
            author: "Siranush Petrosyan",
            initials: "SP",
            role: "Note after today's lesson",
            body: "Read a full sentence unaided today. The letter shapes still need work.",
            action: "15 minutes of reading",
            topic: "The alphabet",
            status: "Summary sent to parents",
          },
        },
        {
          key: "chess",
          label: "Chess",
          lesson: "Chess: Knight tactics",
          tutor: "Tigran · Tomorrow at 6:00 PM",
          tutorInitial: "Տ",
          topic: "Knight tactics",
          prompt: "Find the fork",
          confidence: "Puzzle accuracy improved by 15%",
          note: {
            author: "Tigran Hakobyan",
            initials: "TH",
            role: "Note after today's lesson",
            body: "Spotted the fork two moves ahead. Still rushes the endgame.",
            action: "8 tactics puzzles",
            topic: "Knight forks",
            status: "Summary sent to parents",
          },
        },
      ],
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
        "2tor-ի դասասենյակի օրինակ՝ մաթեմատիկայի, հայերենի և շախմատի դասերով և առաջընթացի գործիքներով",
      live: "Ուղիղ դաս",
      wins: "3 ուսումնական հաջողություն այս շաբաթ",
      streak: "4 շաբաթ անընդմեջ",
      subjects: [
        {
          key: "math",
          label: "Մաթեմատիկա",
          lesson: "Հանրահաշիվ․ տեսողական հավասարումներ",
          tutor: "Աննա · Այսօր՝ 16։00",
          tutorInitial: "Ա",
          topic: "Տեսողական հավասարումներ",
          prompt: "Հավասարակշռիր երկու կողմերը",
          confidence: "Վստահությունն աճել է 18%-ով",
          note: {
            author: "Աննա Ղազարյան",
            initials: "ԱՂ",
            role: "Նշում այսօրվա դասից հետո",
            body: "Եղանակը յուրացրել է վստահ։ Դեռ դանդաղում է, երբ հայտարարները տարբեր են։",
            action: "10 վարժություն",
            topic: "Կոտորակներ",
            status: "Ամփոփումն ուղարկված է ծնողին",
          },
        },
        {
          key: "armenian",
          label: "Հայերեն",
          lesson: "Հայերեն․ ընթերցանություն և գիր",
          tutor: "Սիրանուշ · Այսօր՝ 17։30",
          tutorInitial: "Ս",
          topic: "Այբուբենը",
          prompt: "Հնչյունավորիր յուրաքանչյուր տառը",
          confidence: "Ընթերցանության սահունությունն աճել է 22%-ով",
          note: {
            author: "Սիրանուշ Պետրոսյան",
            initials: "ՍՊ",
            role: "Նշում այսօրվա դասից հետո",
            body: "Այսօր ինքնուրույն կարդաց ամբողջական նախադասություն։ Տառերի ձևերը դեռ վարժանք են պահանջում։",
            action: "15 րոպե ընթերցանություն",
            topic: "Այբուբենը",
            status: "Ամփոփումն ուղարկված է ծնողին",
          },
        },
        {
          key: "chess",
          label: "Շախմատ",
          lesson: "Շախմատ․ ձիու մարտավարություն",
          tutor: "Տիգրան · Վաղը՝ 18։00",
          tutorInitial: "Տ",
          topic: "Ձիու մարտավարություն",
          prompt: "Գտիր պատառաքաղը",
          confidence: "Խնդիրների ճշգրտությունն աճել է 15%-ով",
          note: {
            author: "Տիգրան Հակոբյան",
            initials: "ՏՀ",
            role: "Նշում այսօրվա դասից հետո",
            body: "Պատառաքաղը նկատեց երկու քայլ շուտ։ Դեռ շտապում է վերջնախաղում։",
            action: "8 մարտավարական խնդիր",
            topic: "Ձիու պատառաքաղ",
            status: "Ամփոփումն ուղարկված է ծնողին",
          },
        },
      ],
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
    <div className={styles.page}>
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
