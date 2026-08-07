import { getTranslations } from "next-intl/server";
import type { Locale } from "@app/i18n/config";
import { localHref } from "./content";
import {
  LearningBenefits,
  SubjectExplorer,
  type BenefitsCopy,
  type ClassroomCopy,
  type SubjectCopy,
} from "./compact-home";
import {
  GroupLessonsStrip,
  ParentPreviewStrip,
  type GroupLessonsCopy,
  type ParentPreviewCopy,
} from "./home-sections";
import { Hero } from "./hero";
import { ClosingCta, type ClosingCtaCopy } from "./closing-cta";
import type { ParentsCopy } from "../parents/parents-content";
import styles from "./compact-home.module.css";

/*
 * The type stack is no longer declared here. Plus Jakarta Sans belonged to this page's own visual
 * identity; the public surfaces now share one stack (Instrument Sans / Atkinson Hyperlegible /
 * Noto Sans Armenian) loaded once in `app/(marketing)/layout.tsx` from `../fonts.ts`. Loading a
 * fourth family here would have shipped an extra font download for a page that no longer uses it.
 *
 * This page runs a single face out of that stack — see the header of `compact-home.module.css`.
 */
interface HomeCopy {
  hero: {
    titleLead: string;
    titleAccent: string;
    /*
     * What replaced the hero paragraph. Four differentiators, each a fragment rather than a
     * sentence — these are the things 2tor does that a generic tutoring listing does not, so they
     * earn the space a description of the category would have wasted.
     */
    differentiators: readonly string[];
    courses: string;
  };
  classroom: ClassroomCopy;
  subjects: Omit<SubjectCopy, "items"> & {
    items: readonly Omit<SubjectCopy["items"][number], "href">[];
  };
  benefits: BenefitsCopy;
  group: GroupLessonsCopy;
  parents: ParentPreviewCopy;
  /*
   * The closing band's own copy. Its primary button label is NOT here — that is the header's
   * button and comes from the shared catalogue, same as the hero's. Only `pricing` is local:
   * the footer's `site.footer.pricing` is the bare noun "Pricing", which reads as a nav entry
   * rather than as an action next to "Book a free consultation".
   */
  closing: ClosingCtaCopy & { pricing: string };
}

const copy: Record<Locale, HomeCopy> = {
  en: {
    hero: {
      titleLead: "Big goals start with",
      titleAccent: "one good lesson.",
      differentiators: [
        "Anti-cheating system",
        "Group classes",
        "Office hours outside class",
        "Daily feedback from your tutor",
      ],
      courses: "Explore courses",
    },
    classroom: {
      ariaLabel:
        "2tor classroom preview, cycling through a mathematics, programming, Armenian, and chess lesson, each with the tutor's note afterwards",
      live: "Live lesson",
      courses: "Courses",
      subjects: [
        {
          key: "math",
          label: "Mathematics",
          lesson: "Algebra: Visual equations",
          tutor: "Anna · Today at 4:00 PM",
          tutorInitial: "A",
          topic: "Visual equations",
          prompt: "Balance both sides",
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
          key: "programming",
          label: "Programming",
          lesson: "Programming: Loops",
          tutor: "Davit · Today at 5:00 PM",
          tutorInitial: "D",
          topic: "Loops",
          prompt: "Repeat with purpose",
          note: {
            author: "Davit Sargsyan",
            initials: "DS",
            role: "Note after today's lesson",
            body: "Wrote the loop unprompted. Still forgets to check the exit condition.",
            action: "1 mini project",
            topic: "While loops",
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
          description: "Build confidence through visual problem solving.",
        },
        {
          key: "programming",
          name: "Programming",
          description: "Make it, test it, explain it, improve it. One real project at a time.",
        },
        {
          key: "armenian",
          name: "Armenian Language & Culture",
          description: "Read, write, and speak the language, with the culture behind it.",
        },
        {
          key: "chess",
          name: "Chess",
          description: "Tactics, patience, and thinking two moves ahead.",
        },
      ],
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
        {
          key: "availability",
          signal: "Outside class hours",
          title: "Office hours, not just lessons",
          body: "Tutors keep open office hours between sessions. A student who gets stuck on a Tuesday does not have to stay stuck until Thursday.",
        },
      ],
    },
    group: {
      eyebrow: "Small-group learning",
      title: "Learn alongside two or three others.",
      titleAccent: "two or three",
      body: "Every group is matched by subject, level, and goal, never by whichever slot happened to be free. The same verified tutors, at around 40% less than one to one.",
      points: [
        "Two to four students per group",
        "Matched by level, not by age",
        "Around 40% lower cost",
      ],
      cta: "See how matching works",
      map: {
        ariaLabel:
          "Sample matching map: two students on the same topic, level and schedule, matched into one group with a verified tutor",
        title: "Matching map",
        status: "Comparing fit",
        students: [
          { initials: "AM", name: "Aram", detail: "Grade 6 · Fractions", tag: "Weekday evenings" },
          { initials: "MK", name: "Maya", detail: "Grade 6 · Fractions", tag: "Weekday evenings" },
        ],
        tutorLabel: "Verified tutor",
        result: "Group match found",
        criteria: ["Same topic", "Similar level", "Compatible time"],
      },
    },
    parents: {
      eyebrow: "For parents",
      title: "See what happened, without having to ask.",
      titleAccent: "without having to ask",
      body: "The parent view gathers the next class, the current goal, homework status, and the tutor's latest note in one place, so you are not reconstructing the week out of messages.",
      cta: "See the parent view",
      dashboardAriaLabel:
        "The parent workspace, shown with example content: the current goal and its progress, the next lesson, homework due, and the tutor's latest feedback",
    },
    closing: {
      title: "Start with one good lesson.",
      description:
        "Tell us where your child is stuck. We will suggest a tutor, a level, and a schedule — and you decide afterwards. We are taking 40 families this term.",
      pricing: "See pricing",
      note: "Free · 20 minutes · no card, no obligation",
    },
  },
  hy: {
    hero: {
      titleLead: "Մեծ նպատակները սկսվում են",
      titleAccent: "մեկ լավ դասից։",
      differentiators: [
        "Խաբեության դեմ համակարգ",
        "Խմբային դասեր",
        "Բաց ժամեր դասից դուրս",
        "Ամենօրյա արձագանք ուսուցչից",
      ],
      courses: "Դիտել դասընթացները",
    },
    classroom: {
      ariaLabel:
        "2tor-ի դասասենյակի օրինակ՝ մաթեմատիկայի, ծրագրավորման, հայերենի և շախմատի դասերով և յուրաքանչյուրից հետո ուսուցչի նշումով",
      live: "Ուղիղ դաս",
      courses: "Դասընթացներ",
      subjects: [
        {
          key: "math",
          label: "Մաթեմատիկա",
          lesson: "Հանրահաշիվ․ տեսողական հավասարումներ",
          tutor: "Աննա · Այսօր՝ 16։00",
          tutorInitial: "Ա",
          topic: "Տեսողական հավասարումներ",
          prompt: "Հավասարակշռիր երկու կողմերը",
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
          key: "programming",
          label: "Ծրագրավորում",
          lesson: "Ծրագրավորում․ ցիկլեր",
          tutor: "Դավիթ · Այսօր՝ 17։00",
          tutorInitial: "Դ",
          topic: "Ցիկլեր",
          prompt: "Կրկնիր նպատակով",
          note: {
            author: "Դավիթ Սարգսյան",
            initials: "ԴՍ",
            role: "Նշում այսօրվա դասից հետո",
            body: "Ցիկլը գրեց ինքնուրույն։ Դեռ մոռանում է ստուգել ելքի պայմանը։",
            action: "1 փոքր նախագիծ",
            topic: "While ցիկլեր",
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
          description: "Վստահություն՝ տեսողական խնդիրների միջոցով։",
        },
        {
          key: "programming",
          name: "Ծրագրավորում",
          description: "Ստեղծել, փորձարկել, բացատրել, բարելավել՝ մեկ իրական նախագծով։",
        },
        {
          key: "armenian",
          name: "Հայոց լեզու և մշակույթ",
          description: "Կարդալ, գրել և խոսել՝ մշակույթի հետ միասին։",
        },
        {
          key: "chess",
          name: "Շախմատ",
          description: "Մարտավարություն, համբերություն և երկու քայլ առաջ մտածելը։",
        },
      ],
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
        {
          key: "availability",
          signal: "Դասից դուրս ժամերին",
          title: "Բաց ժամեր, ոչ միայն դասեր",
          body: "Ուսուցիչները դասերի միջև ունեն բաց ժամեր։ Երեքշաբթի դժվարացած սովորողը ստիպված չէ սպասել մինչև հինգշաբթի։",
        },
      ],
    },
    group: {
      eyebrow:
        "\u0553\u0578\u0584\u0580 \u056d\u0574\u0562\u0578\u057e \u0578\u0582\u057d\u0578\u0582\u0581\u0578\u0582\u0574",
      title: "Սովորիր ևս երկու-երեք հոգու հետ։",
      titleAccent: "երկու-երեք",
      body: "Յուրաքանչյուր խումբ կազմվում է ըստ առարկայի, մակարդակի և նպատակի, ոչ թե ըստ ազատ ժամի։ Նույն ստուգված ուսուցիչները՝ մոտ 40%-ով ավելի մատչելի, քան անհատական դասերը։",
      points: [
        "\u0535\u0580\u056f\u0578\u0582\u057d\u056b\u0581 \u0579\u0578\u0580\u057d \u057d\u0578\u057e\u0578\u0580\u0578\u0572 \u056d\u0574\u0562\u0578\u0582\u0574",
        "\u0540\u0561\u0574\u0561\u057a\u0561\u057f\u0561\u057d\u056d\u0561\u0576\u0565\u0581\u0578\u0582\u0574 \u0568\u057d\u057f \u0574\u0561\u056f\u0561\u0580\u0564\u0561\u056f\u056b, \u0578\u0579 \u0569\u0565 \u057f\u0561\u0580\u056b\u0584\u056b",
        "\u0544\u0578\u057f 40%-\u0578\u057e \u0581\u0561\u056e\u0580 \u0561\u0580\u056a\u0565\u0584",
      ],
      cta: "\u054f\u0565\u057d\u0576\u0565\u056c, \u0569\u0565 \u056b\u0576\u0579\u057a\u0565\u057d \u0567 \u056f\u0561\u0566\u0574\u057e\u0578\u0582\u0574 \u056d\u0578\u0582\u0574\u0562\u0568",
      map: {
        ariaLabel:
          "\u0540\u0561\u0574\u0561\u0564\u0580\u0574\u0561\u0576 \u0584\u0561\u0580\u057f\u0565\u0566\u056b \u0585\u0580\u056b\u0576\u0561\u056f\u055d \u0576\u0578\u0582\u0575\u0576 \u0569\u0565\u0574\u0561\u0576, \u0574\u0561\u056f\u0561\u0580\u0564\u0561\u056f\u0568 \u0587 \u056a\u0561\u0574\u0565\u0580\u0576 \u0578\u0582\u0576\u0565\u0581\u0578\u0572 \u0565\u0580\u056f\u0578\u0582 \u057d\u0578\u057e\u0578\u0580\u0578\u0572\u055d \u0570\u0561\u0574\u0561\u0564\u0580\u057e\u0561\u056e \u0574\u0565\u056f \u056d\u0574\u0562\u0578\u0582\u0574 \u057d\u057f\u0578\u0582\u0563\u057e\u0561\u056e \u0564\u0561\u057d\u0561\u057e\u0561\u0576\u0564\u0578\u0572\u056b \u0570\u0565\u057f",
        title:
          "\u0540\u0561\u0574\u0561\u0564\u0580\u0574\u0561\u0576 \u0584\u0561\u0580\u057f\u0565\u0566",
        status: "\u054d\u057f\u0578\u0582\u0563\u057e\u0578\u0582\u0574 \u0567",
        students: [
          {
            // Latin initials in both locales, matching the same figures on `/group-lessons`.
            initials: "AM",
            name: "\u0531\u0580\u0561\u0574",
            detail:
              "6-\u0580\u0564 \u0564\u0561\u057d\u0561\u0580\u0561\u0576 \u00b7 \u053f\u0578\u057f\u0578\u0580\u0561\u056f\u0576\u0565\u0580",
            tag: "\u0535\u0580\u0565\u056f\u0578\u0575\u0561\u0576",
          },
          {
            initials: "MK",
            name: "\u0544\u0561\u0575\u0561",
            detail:
              "6-\u0580\u0564 \u0564\u0561\u057d\u0561\u0580\u0561\u0576 \u00b7 \u053f\u0578\u057f\u0578\u0580\u0561\u056f\u0576\u0565\u0580",
            tag: "\u0535\u0580\u0565\u056f\u0578\u0575\u0561\u0576",
          },
        ],
        tutorLabel:
          "\u054d\u057f\u0578\u0582\u0563\u057e\u0561\u056e \u0564\u0561\u057d\u0561\u057e\u0561\u0576\u0564\u0578\u0572",
        result:
          "\u053d\u0578\u0582\u0574\u0562\u0568 \u0570\u0561\u0574\u0561\u0564\u0580\u057e\u0561\u056e \u0567",
        criteria: [
          "\u0546\u0578\u0582\u0575\u0576 \u0569\u0565\u0574\u0561\u0576",
          "\u0546\u0574\u0561\u0576 \u0574\u0561\u056f\u0561\u0580\u0564\u0561\u056f",
          "\u0540\u0561\u0574\u0568\u0576\u056f\u0576\u0578\u0572 \u056a\u0561\u0574\u0565\u0580",
        ],
      },
    },
    parents: {
      eyebrow: "\u053e\u0576\u0578\u0572\u0576\u0565\u0580\u056b \u0570\u0561\u0574\u0561\u0580",
      title: "Տեսեք, թե ինչ է եղել՝ առանց հարցնելու։",
      titleAccent: "առանց հարցնելու",
      body: "\u053e\u0576\u0578\u0572\u056b \u0567\u057b\u0578\u0582\u0574 \u0574\u0565\u056f \u057f\u0565\u0572\u0578\u0582\u0574 \u0570\u0561\u057e\u0561\u0584\u057e\u0561\u056e \u0565\u0576 \u0570\u0561\u057b\u0578\u0580\u0564 \u0564\u0561\u057d\u0568, \u0568\u0576\u0569\u0561\u0581\u056b\u056f \u0576\u057a\u0561\u057f\u0561\u056f\u0568, \u057f\u0576\u0561\u0575\u056b\u0576 \u0561\u0577\u056d\u0561\u057f\u0561\u0576\u0584\u056b \u056f\u0561\u0580\u0563\u0561\u057e\u056b\u0573\u0561\u056f\u0568 \u0587 \u0578\u0582\u057d\u0578\u0582\u0581\u0579\u056b \u057e\u0565\u0580\u057b\u056b\u0576 \u0576\u0577\u0578\u0582\u0574\u0568\u0589",
      cta: "\u054f\u0565\u057d\u0576\u0565\u056c \u056e\u0576\u0578\u0572\u056b \u0567\u057b\u0568",
      dashboardAriaLabel:
        "Ծնողի էջը՝ օրինակային բովանդակությամբ՝ ընթացիկ նպատակը և դրա առաջընթացը, հաջորդ դասը, տնային առաջադրանքը և ուսուցչի վերջին կարծիքը",
    },
    closing: {
      title: "Սկսեք մեկ լավ դասից։",
      description:
        "Պատմեք, թե որտեղ է ձեր երեխան դժվարանում։ Մենք կառաջարկենք ուսուցիչ, մակարդակ և ժամանակացույց, իսկ որոշումը ձերն է։ Այս կիսամյակում ընդունում ենք 40 ընտանիք։",
      pricing: "Տեսնել գները",
      note: "Անվճար · 20 րոպե · առանց քարտի և պարտավորության",
    },
  },
};

/*
 * Every one of these is a real, publicly reachable marketing page — `/chess` was added alongside
 * this card (`seo.ts` `pageSlugs`, `marketing-site.tsx` `pageKey`, `proxy.ts` `PUBLIC_PATHS`, and
 * `pages.chess.*` in both message catalogues). A card pointing at an unregistered path would not
 * 404; `proxy.ts` is deny-by-default, so it would bounce a logged-out visitor to `/login`.
 */
const subjectPaths: Record<HomeCopy["subjects"]["items"][number]["key"], string> = {
  math: "/mathematics",
  programming: "/programming",
  armenian: "/armenian-language-heritage",
  chess: "/chess",
};

export async function HomePageContent({ locale }: { locale: Locale }) {
  const content = copy[locale];
  const subjects: SubjectCopy = {
    ...content.subjects,
    items: content.subjects.items.map((item) => ({
      ...item,
      href: localHref(locale, subjectPaths[item.key]),
    })),
  };

  /*
   * The consultation label is read from the shared marketing catalogue rather than restated in the
   * copy record above, because the hero's primary button IS the header's button — same component
   * styles, same destination. Two copies of the string would drift the moment one is reworded.
   */
  const t = await getTranslations({ locale, namespace: "marketing" });

  /*
   * The workspace mock's own copy comes from the `parents` namespace rather than from this file's
   * copy record: the home page shows the same component the `/parents` page shows, and duplicating
   * its strings here is how the preview and the page it links to start describing different weeks.
   */
  const pt = await getTranslations({ locale, namespace: "parents" });
  const parentDashboard = pt.raw("content.dashboard") as ParentsCopy["dashboard"];

  return (
    <div className={styles.page}>
      <Hero
        titleLead={content.hero.titleLead}
        titleAccent={content.hero.titleAccent}
        differentiators={content.hero.differentiators}
        consultationCta={{
          label: t("site.actions.consultation"),
          href: localHref(locale, "/consultation"),
        }}
        coursesCta={{ label: content.hero.courses, href: "#courses" }}
        classroom={content.classroom}
      />
      <SubjectExplorer copy={subjects} />
      <LearningBenefits copy={content.benefits} />
      <GroupLessonsStrip copy={content.group} href={localHref(locale, "/group-lessons")} />
      <ParentPreviewStrip
        copy={content.parents}
        dashboard={parentDashboard}
        href={localHref(locale, "/parents")}
      />
      <ClosingCta
        copy={content.closing}
        consultationCta={{
          label: t("site.actions.consultation"),
          href: localHref(locale, "/consultation"),
        }}
        pricingCta={{ label: content.closing.pricing, href: localHref(locale, "/pricing") }}
      />
    </div>
  );
}
