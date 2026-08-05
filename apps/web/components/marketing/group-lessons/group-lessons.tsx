"use client";

import Link from "next/link";
import { Noto_Sans_Armenian, Plus_Jakarta_Sans } from "next/font/google";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Hand,
  Lightbulb,
  LockKeyhole,
  MessageCircleMore,
  Network,
  PencilLine,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Locale } from "@app/i18n/config";
import { localHref } from "../home/content";
import styles from "./group-lessons.module.css";

const displayFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--group-font-display",
});

const bodyFont = Noto_Sans_Armenian({
  subsets: ["armenian", "latin"],
  weight: "variable",
  display: "swap",
  variable: "--group-font-body",
});

export const GROUP_SIZE_RANGE = { minimum: 2, maximum: 4 } as const;

const subjectOptions = [
  { id: "mathematics", en: "Mathematics", hy: "Մաթեմատիկա", range: { en: "Grades 1–Precalculus", hy: "1-ին դասարան–Նախահաշիվ" }, topics: { en: "Fractions, algebra, geometry, exam preparation", hy: "Կոտորակներ, հանրահաշիվ, երկրաչափություն, քննություններ" } },
  { id: "programming", en: "Programming", hy: "Ծրագրավորում", range: { en: "Level confirmed during matching", hy: "Մակարդակը ճշտվում է համադրման ընթացքում" }, topics: { en: "Web projects, creative coding, testing and debugging", hy: "Վեբ նախագծեր, ստեղծագործական կոդավորում, թեստավորում" } },
  { id: "armenian", en: "Armenian language & culture", hy: "Հայոց լեզու և մշակույթ", range: { en: "Level confirmed during matching", hy: "Մակարդակը ճշտվում է համադրման ընթացքում" }, topics: { en: "Reading, speaking, writing, history and culture", hy: "Ընթերցանություն, խոսք, գրավոր խոսք, պատմություն և մշակույթ" } },
  { id: "sat", en: "SAT preparation", hy: "SAT-ի նախապատրաստում", range: { en: "High school", hy: "Ավագ դպրոց" }, topics: { en: "Reading and writing, mathematics, pacing strategy", hy: "Ընթերցանություն և գրավոր խոսք, մաթեմատիկա, ժամանակի կառավարում" } },
  { id: "toefl", en: "TOEFL preparation", hy: "TOEFL-ի նախապատրաստում", range: { en: "Level confirmed during matching", hy: "Մակարդակը ճշտվում է համադրման ընթացքում" }, topics: { en: "Reading, listening, speaking and writing", hy: "Ընթերցանություն, լսում, խոսք և գրավոր խոսք" } },
] as const;

const copy = {
  en: {
    eyebrow: "Small-group learning",
    heroTitle: "Learn together. Pay less. Stay challenged.",
    heroBody: "Students are matched by subject, current level, learning goals, and schedule—so they can learn together without being held back or left behind.",
    saving: "Group lessons can cost around 40% less than individual classes.",
    availability: "Availability depends on finding compatible learners.",
    primary: "Join the matching list",
    secondary: "See how matching works",
    consultation: "Book a free consultation",
    trust: ["Small, level-matched groups", "Verified tutors", "Parent progress updates"],
    compare: {
      eyebrow: "Choose the right format",
      title: "Why families choose group lessons",
      body: "Both formats use structured live teaching. The better choice depends on the learner, the topic, and how much personalization they need.",
      individual: "Individual lessons",
      individualItems: ["Maximum one-to-one attention", "Fully personalized pace", "Best for highly specific needs", "Higher price"],
      group: "Small-group lessons",
      groupItems: ["Lower cost and shared learning", "Peer motivation and varied solution methods", "Best for shared topics and similar levels", "Dependent on a compatible match"],
      note: "The best format depends on the student’s learning needs, personality, topic, and goals.",
      badge: "Around 40% lower cost",
    },
    process: {
      eyebrow: "The matching path",
      title: "How we build the right group",
      body: "We do not place students together just because a time slot is open. Each step checks whether the group can learn at a productive shared pace.",
      steps: [
        ["Tell us about the learner", "Subject, course, current level, goal, and schedule."],
        ["Check readiness", "We review the information and may recommend a parent conversation."],
        ["Search for compatible students", "We compare topic, level, pace, goal, and availability."],
        ["Confirm the group", "You review the tutor, schedule, group size, price, and start date."],
        ["Begin learning together", "The group starts once the matching conditions are met."],
      ],
    },
    criteria: {
      eyebrow: "Compatibility matters",
      title: "We match by level, not just age",
      body: "Two students in the same school grade may need very different mathematics instruction. A useful group shares a learning problem—not only a birth year.",
      example: "Two Grade 7 students may not be suitable classmates if one is learning basic fractions and the other is ready for Algebra I.",
      factors: ["Current knowledge", "Specific topic", "Learning pace", "Confidence", "Schedule", "Academic goal"],
      strong: "Strong match",
      strongItems: ["Same topic", "Similar readiness", "Compatible schedule", "Similar pace"],
      weak: "Weak match",
      weakItems: ["Same age only", "Different skill level", "Different goals", "Conflicting schedule"],
    },
    waiting: {
      eyebrow: "Clear expectations",
      title: "What happens if a group is not ready yet?",
      body: "Because groups are matched carefully, a suitable group may not be available immediately. Waiting is better than forcing a learner into the wrong pace.",
      states: [
        ["Match available", "We found a group that fits the learner’s topic, level, and schedule.", "Review group details"],
        ["Nearly matched", "A compatible learner is waiting while we look for another suitable classmate.", "Stay on the list"],
        ["Waiting for a match", "We are still looking for students with a similar level and schedule.", "Update availability"],
      ],
      options: "You can stay on the list, broaden availability, consider individual lessons, or speak with an advisor.",
    },
    classroom: {
      eyebrow: "Inside the lesson",
      title: "What happens during a group lesson",
      body: "The tutor moves between shared explanation, individual turns, and a collaborative challenge—while monitoring who needs a different prompt.",
      timeline: ["Warm-up", "Tutor explanation", "Guided examples", "Student discussion", "Individual practice", "Shared challenge", "Feedback"],
    },
    benefits: {
      eyebrow: "Learning value",
      title: "More than a cheaper lesson",
      items: [
        ["Learn from more than one explanation", "Students hear different questions, approaches, and solution methods."],
        ["Build confidence speaking about ideas", "Students practice explaining their thinking instead of only giving answers."],
        ["Stay accountable", "A small group creates rhythm, consistency, and peer motivation."],
        ["Build a learning network", "Students meet peers working toward similar academic goals."],
      ],
    },
    attention: {
      eyebrow: "Quality in a small group",
      title: "Small enough for real attention",
      body: "Tutors track participation, give each learner individual turns, adjust exercise difficulty, and record student-specific progress and homework.",
      note: "If a student’s level changes significantly, the tutor may recommend a different group or individual support.",
    },
    pricing: {
      eyebrow: "Transparent value",
      title: "Better value through shared teaching",
      body: "One verified tutor teaches a well-matched shared topic efficiently, lowering the cost per learner without turning the class into a large lecture.",
      individual: "Individual lesson",
      group: "Group lesson",
      individualPrice: "Personalized rate",
      groupPrice: "Confirmed with placement",
      saving: "Often around 40% less",
      note: "Pricing can vary by subject and group size. Final pricing is shown before you confirm the group.",
    },
    suitability: {
      eyebrow: "A practical decision",
      title: "Is a group lesson right for your child?",
      group: "Group lessons may be a strong fit when",
      groupItems: ["The learner is comfortable with peers", "Several learners share the topic", "Discussion helps ideas click", "A shared schedule is workable", "The skill level is reasonably stable"],
      individual: "Individual lessons may be better when",
      individualItems: ["There are major learning gaps", "The learner needs an unusual pace", "The schedule is highly limited", "A specific exam or deadline is close", "Intensive one-to-one support is needed"],
      cta: "Help me choose the right format",
    },
    subjects: {
      eyebrow: "Current curriculum",
      title: "Available group subjects",
      body: "Tell us the subject and starting point. We will look for a compatible group; these cards do not indicate current availability.",
      cta: "Join matching",
    },
    form: {
      eyebrow: "Join the list",
      title: "Find a suitable learning group",
      body: "Share a few details. We will look for students with a similar level, goal, and schedule.",
      steps: ["Subject & level", "Learning goal", "Current level", "Availability", "Parent contact", "Review"],
      next: "Continue",
      back: "Back",
      subject: "Subject",
      grade: "Grade or course",
      topic: "Current topic",
      goal: "Learning goal",
      level: "Current level",
      timezone: "Time zone",
      days: "Preferred days",
      times: "Preferred time",
      flexibility: "Schedule flexibility",
      parentName: "Parent or guardian name",
      email: "Email",
      phone: "Phone (optional)",
      consent: "I agree to the Privacy Policy.",
      noGuarantee: "This request does not guarantee immediate placement.",
      flexibleHint: "The more flexible your schedule, the easier it may be to form a suitable group.",
      error: "We could not send this request. Check the fields and try again.",
      sending: "Joining the list…",
      submit: "Join the matching list",
      summary: "Matching request summary",
      submitted: "You are on the group matching list",
      submittedBody: "We will contact you when a suitable group becomes available.",
      status: "Searching for compatible students",
      submittedDate: "Date submitted",
      update: "Start another request",
      consult: "Book an individual consultation",
    },
    faq: {
      eyebrow: "Questions, answered",
      title: "Group lesson FAQ",
      items: [
        ["How many students are in a group?", `Groups are intentionally small—usually around ${GROUP_SIZE_RANGE.minimum}–${GROUP_SIZE_RANGE.maximum} learners. The proposed size is shown before you confirm.`],
        ["How do you decide which students belong together?", "We compare subject knowledge, topic, pace, confidence, academic goal, and schedule. Age or grade alone is not enough."],
        ["Does my child need a placement assessment?", "Not always. We first review the information you provide and may recommend a short conversation or readiness check."],
        ["How long does matching take?", "There is no fixed wait time. It depends on finding learners with a compatible level, topic, and schedule."],
        ["What happens if no group is available?", "You can remain on the list, update availability, speak with an advisor, or consider individual lessons."],
        ["Are group lessons always 40% cheaper?", "No. They can cost around 40% less, but the exact difference depends on the subject, group size, and current pricing."],
        ["Will my child receive individual feedback?", "Yes. Tutors can track participation, progress, homework, and next steps for each learner."],
        ["Can my child leave or change groups?", "Speak with the team if the pace, schedule, or group fit changes. We will review the most suitable next step."],
        ["Can siblings join the same group?", "Possibly—if their topic, readiness, goals, and schedule are genuinely compatible."],
        ["What if one student progresses faster?", "The tutor can vary exercise difficulty. A different group or individual support may be recommended if the gap becomes significant."],
        ["Are group lessons available for every subject?", "Availability varies. Joining the list tells us what you need; it does not promise that a group is currently open."],
        ["Can we switch to individual lessons?", "Yes. An advisor can help compare the two formats when your learner’s needs change."],
      ],
    },
    final: {
      title: "Find the right students to learn alongside.",
      body: "Tell us your child’s subject, level, and availability. We will search for a compatible small group.",
      note: "You review the group, schedule, and price before confirming.",
    },
  },
  hy: {
    eyebrow: "Փոքր խմբերով ուսուցում",
    heroTitle: "Սովորել միասին։ Վճարել քիչ։ Մնալ մոտիվացված։",
    heroBody: "Սովորողներին համադրում ենք ըստ առարկայի, ներկա մակարդակի, նպատակների և ժամանակացույցի, որպեսզի խումբը առաջ շարժվի միասին։",
    saving: "Խմբային դասերը կարող են արժենալ մոտ 40% ավելի քիչ, քան անհատական դասերը։",
    availability: "Հասանելիությունը կախված է համապատասխան սովորողներ գտնելուց։",
    primary: "Միանալ համադրման ցանկին",
    secondary: "Տեսնել՝ ինչպես է աշխատում",
    consultation: "Ամրագրել անվճար խորհրդատվություն",
    trust: ["Փոքր, մակարդակով համադրված խմբեր", "Ստուգված դասավանդողներ", "Առաջընթացի ամփոփումներ ծնողներին"],
    compare: {
      eyebrow: "Ընտրեք ճիշտ ձևաչափը",
      title: "Ինչու են ընտանիքներն ընտրում խմբային դասերը",
      body: "Երկու ձևաչափն էլ կենդանի, կառուցվածքային ուսուցում են։ Ճիշտ ընտրությունը կախված է սովորողից, թեմայից և անհատականացման կարիքից։",
      individual: "Անհատական դասեր",
      individualItems: ["Առավելագույն անհատական ուշադրություն", "Լիովին անհատական տեմպ", "Հատուկ կարիքների համար", "Ավելի բարձր գին"],
      group: "Փոքր խմբային դասեր",
      groupItems: ["Ավելի ցածր գին և համատեղ ուսուցում", "Հասակակիցների մոտիվացիա", "Ընդհանուր թեմաների համար", "Կախված է համապատասխան համադրումից"],
      note: "Լավագույն ձևաչափը կախված է սովորողի կարիքներից, բնավորությունից, թեմայից և նպատակներից։",
      badge: "Մոտ 40% ավելի ցածր գին",
    },
    process: {
      eyebrow: "Համադրման ուղին",
      title: "Ինչպես ենք ձևավորում ճիշտ խումբը",
      body: "Մենք սովորողներին չենք միավորում միայն ազատ ժամի պատճառով։ Յուրաքանչյուր քայլով ստուգում ենք՝ արդյոք խումբը կարող է օգտակար ընդհանուր տեմպով սովորել։",
      steps: [["Պատմեք սովորողի մասին", "Առարկա, դասարան, մակարդակ, նպատակ և ժամանակացույց։"], ["Ստուգենք պատրաստվածությունը", "Ուսումնասիրում ենք տվյալները և անհրաժեշտության դեպքում առաջարկում զրույց։"], ["Փնտրենք համապատասխան սովորողներ", "Համեմատում ենք թեման, մակարդակը, տեմպը, նպատակը և ժամերը։"], ["Հաստատենք խումբը", "Տեսնում եք դասավանդողին, ժամերը, խմբի չափը, գինը և մեկնարկը։"], ["Սկսենք սովորել միասին", "Խումբը սկսում է, երբ համադրման պայմանները բավարարված են։"]],
    },
    criteria: {
      eyebrow: "Համատեղելիությունը կարևոր է",
      title: "Համադրում ենք ըստ մակարդակի, ոչ միայն տարիքի",
      body: "Նույն դասարանի երկու սովորող կարող են մաթեմատիկայի շատ տարբեր կարիքներ ունենալ։ Օգտակար խումբը կիսում է ուսումնական խնդիրը, ոչ միայն տարիքը։",
      example: "7-րդ դասարանի երկու սովորող կարող են չհամապատասխանել, եթե մեկը սովորում է հիմնական կոտորակներ, իսկ մյուսը պատրաստ է Հանրահաշիվ I-ի։",
      factors: ["Ներկա գիտելիք", "Կոնկրետ թեմա", "Ուսուցման տեմպ", "Վստահություն", "Ժամանակացույց", "Ուսումնական նպատակ"],
      strong: "Ուժեղ համադրում",
      strongItems: ["Նույն թեման", "Նման պատրաստվածություն", "Համատեղելի ժամեր", "Նման տեմպ"],
      weak: "Թույլ համադրում",
      weakItems: ["Միայն նույն տարիքը", "Տարբեր մակարդակ", "Տարբեր նպատակներ", "Անհամատեղելի ժամեր"],
    },
    waiting: {
      eyebrow: "Հստակ սպասումներ",
      title: "Ի՞նչ է լինում, եթե խումբը դեռ պատրաստ չէ",
      body: "Քանի որ խմբերը համադրում ենք ուշադիր, համապատասխան խումբը կարող է անմիջապես հասանելի չլինել։",
      states: [["Համադրումը պատրաստ է", "Գտել ենք համապատասխան թեմայով, մակարդակով և ժամերով խումբ։", "Տեսնել մանրամասները"], ["Գրեթե համադրված է", "Համապատասխան սովորող սպասում է, մինչ փնտրում ենք ևս մեկ դասընկեր։", "Մնալ ցանկում"], ["Սպասում է համադրման", "Փնտրում ենք նման մակարդակով և ժամերով սովորողներ։", "Փոխել ժամերը"]],
      options: "Կարող եք մնալ ցանկում, ընդլայնել հասանելի ժամերը, դիտարկել անհատական դաս կամ խոսել խորհրդատուի հետ։",
    },
    classroom: { eyebrow: "Դասի ներսում", title: "Ինչ է տեղի ունենում խմբային դասի ժամանակ", body: "Դասավանդողը համատեղում է ընդհանուր բացատրությունը, անհատական հերթերը և խմբային առաջադրանքը՝ հետևելով յուրաքանչյուր սովորողի կարիքին։", timeline: ["Տաքացում", "Բացատրություն", "Օրինակներ", "Քննարկում", "Անհատական փորձ", "Ընդհանուր մարտահրավեր", "Արձագանք"] },
    benefits: { eyebrow: "Ուսումնական արժեք", title: "Ավելին, քան պարզապես ավելի էժան դաս", items: [["Սովորել տարբեր բացատրություններից", "Սովորողները լսում են տարբեր հարցեր, մոտեցումներ և լուծման եղանակներ։"], ["Վստահ խոսել գաղափարների մասին", "Սովորողները սովորում են բացատրել մտածողությունը, ոչ միայն ասել պատասխանը։"], ["Մնալ պատասխանատու", "Փոքր խումբը ստեղծում է ռիթմ, հետևողականություն և մոտիվացիա։"], ["Կառուցել ուսումնական ցանց", "Սովորողները հանդիպում են նման նպատակներով հասակակիցների։"]] },
    attention: { eyebrow: "Որակ փոքր խմբում", title: "Բավական փոքր՝ իրական ուշադրության համար", body: "Դասավանդողը հետևում է մասնակցությանը, տալիս է անհատական հերթեր, փոխում է բարդությունը և գրանցում յուրաքանչյուր սովորողի առաջընթացը։", note: "Եթե սովորողի մակարդակը զգալի փոխվի, դասավանդողը կարող է առաջարկել այլ խումբ կամ անհատական աջակցություն։" },
    pricing: { eyebrow: "Թափանցիկ արժեք", title: "Ավելի լավ արժեք՝ համատեղ ուսուցմամբ", body: "Մեկ ստուգված դասավանդողը արդյունավետ դասավանդում է լավ համադրված ընդհանուր թեմա՝ առանց դասը մեծ լսարանի վերածելու։", individual: "Անհատական դաս", group: "Խմբային դաս", individualPrice: "Անհատականացված գին", groupPrice: "Հաստատվում է տեղավորման հետ", saving: "Հաճախ մոտ 40% ավելի քիչ", note: "Գինը կարող է տարբեր լինել ըստ առարկայի և խմբի չափի։ Վերջնական գինը տեսնում եք մինչև հաստատելը։" },
    suitability: { eyebrow: "Գործնական որոշում", title: "Խմբային դասն արդյո՞ք հարմար է ձեր երեխային", group: "Խմբային դասը կարող է հարմար լինել, երբ", groupItems: ["Սովորողը հարմարավետ է հասակակիցների հետ", "Մի քանի սովորող ունի նույն թեման", "Քննարկումն օգնում է հասկանալ", "Ընդհանուր ժամերը հարմար են", "Մակարդակը համեմատաբար կայուն է"], individual: "Անհատական դասը կարող է լավ լինել, երբ", individualItems: ["Կան մեծ գիտելիքային բացեր", "Պետք է անսովոր տեմպ", "Ժամերը շատ սահմանափակ են", "Մոտ է հատուկ քննություն կամ վերջնաժամկետ", "Պետք է ինտենսիվ անհատական աջակցություն"], cta: "Օգնեք ընտրել ճիշտ ձևաչափը" },
    subjects: { eyebrow: "Ընթացիկ ծրագիր", title: "Խմբային դասերի առարկաներ", body: "Նշեք առարկան և մեկնարկային մակարդակը։ Մենք կփնտրենք համապատասխան խումբ. քարտերը չեն նշանակում, որ խումբն այժմ հասանելի է։", cta: "Միանալ համադրմանը" },
    form: { eyebrow: "Միացեք ցանկին", title: "Գտնել համապատասխան ուսումնական խումբ", body: "Կիսվեք մի քանի տվյալով։ Մենք կփնտրենք նման մակարդակով, նպատակով և ժամերով սովորողներ։", steps: ["Առարկա և մակարդակ", "Նպատակ", "Ներկա մակարդակ", "Հասանելիություն", "Ծնողի կապ", "Ստուգում"], next: "Շարունակել", back: "Հետ", subject: "Առարկա", grade: "Դասարան կամ դասընթաց", topic: "Ներկա թեմա", goal: "Ուսումնական նպատակ", level: "Ներկա մակարդակ", timezone: "Ժամային գոտի", days: "Նախընտրելի օրեր", times: "Նախընտրելի ժամ", flexibility: "Ժամերի ճկունություն", parentName: "Ծնողի կամ խնամակալի անուն", email: "Էլ․ հասցե", phone: "Հեռախոս (ըստ ցանկության)", consent: "Համաձայն եմ Գաղտնիության քաղաքականությանը։", noGuarantee: "Հայտը չի երաշխավորում անմիջական տեղավորում։", flexibleHint: "Որքան ճկուն են ժամերը, այնքան հեշտ կարող է լինել համապատասխան խումբ ձևավորելը։", error: "Չհաջողվեց ուղարկել հայտը։ Ստուգեք դաշտերը և նորից փորձեք։", sending: "Միանում է…", submit: "Միանալ համադրման ցանկին", summary: "Հայտի ամփոփում", submitted: "Դուք խմբային համադրման ցանկում եք", submittedBody: "Մենք կկապվենք, երբ համապատասխան խումբ հասանելի լինի։", status: "Փնտրում ենք համապատասխան սովորողներ", submittedDate: "Ուղարկման ամսաթիվ", update: "Սկսել նոր հայտ", consult: "Ամրագրել անհատական խորհրդատվություն" },
    faq: { eyebrow: "Հարցեր և պատասխաններ", title: "Խմբային դասերի FAQ", items: [["Քանի՞ սովորող է խմբում", `Խմբերը փոքր են՝ սովորաբար մոտ ${GROUP_SIZE_RANGE.minimum}–${GROUP_SIZE_RANGE.maximum} սովորող։ Առաջարկվող չափը տեսնում եք մինչև հաստատելը։`], ["Ինչպե՞ս եք համադրում սովորողներին", "Համեմատում ենք գիտելիքը, թեման, տեմպը, վստահությունը, նպատակը և ժամերը։"], ["Պե՞տք է գնահատում անցնել", "Ոչ միշտ։ Նախ ուսումնասիրում ենք ձեր տրամադրած տվյալները։"], ["Որքա՞ն է տևում համադրումը", "Ֆիքսված ժամկետ չկա. այն կախված է համապատասխան սովորողներ գտնելուց։"], ["Ի՞նչ կլինի, եթե խումբ չլինի", "Կարող եք մնալ ցանկում, փոխել ժամերը կամ ընտրել անհատական դաս։"], ["Միշտ 40% ավելի էժա՞ն է", "Ոչ։ Տարբերությունը կախված է առարկայից, խմբի չափից և գործող գներից։"], ["Կլինի՞ անհատական արձագանք", "Այո։ Դասավանդողը հետևում է յուրաքանչյուր սովորողի մասնակցությանը և առաջընթացին։"], ["Կարելի՞ է փոխել խումբը", "Թիմը կվերանայի լավագույն հաջորդ քայլը, եթե տեմպը կամ համադրումը փոխվի։"], ["Քույրերն ու եղբայրները կարո՞ղ են միասին լինել", "Հնարավոր է, եթե թեման, մակարդակը, նպատակները և ժամերը համատեղելի են։"], ["Ի՞նչ կլինի, եթե մեկը արագ առաջադիմի", "Դասավանդողը կարող է փոխել բարդությունը կամ առաջարկել այլ աջակցություն։"], ["Բոլոր առարկաներով կա՞ն խմբեր", "Հասանելիությունը տարբեր է և ցուցակում միանալը չի խոստանում բաց խումբ։"], ["Կարելի՞ է անցնել անհատական դասերի", "Այո։ Խորհրդատուն կարող է օգնել համեմատել տարբերակները։"]] },
    final: { title: "Գտեք ճիշտ դասընկերներին միասին սովորելու համար։", body: "Նշեք ձեր երեխայի առարկան, մակարդակը և հասանելիությունը։ Մենք կփնտրենք համապատասխան փոքր խումբ։", note: "Խումբը, ժամերը և գինը տեսնում եք մինչև հաստատելը։" },
  },
} as const;

type GroupCopy = (typeof copy)[Locale];
type FormValues = {
  subject: string;
  grade: string;
  topic: string;
  goal: string;
  level: string;
  timezone: string;
  days: string[];
  times: string;
  flexibility: string;
  parentName: string;
  email: string;
  phone: string;
};

const initialForm: FormValues = { subject: "", grade: "", topic: "", goal: "", level: "", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", days: [], times: "", flexibility: "medium", parentName: "", email: "", phone: "" };

function SectionHeading({ eyebrow, title, body, inverse = false }: { eyebrow: string; title: string; body?: string; inverse?: boolean }) {
  return <div className={`${styles.sectionHeading} ${inverse ? styles.inverseHeading : ""}`}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2>{body && <p>{body}</p>}</div>;
}

function ButtonLink({ href, children, secondary = false }: { href: string; children: ReactNode; secondary?: boolean }) {
  return <Link className={secondary ? styles.secondaryButton : styles.primaryButton} href={href}>{children}<ArrowRight aria-hidden="true" size={17} /></Link>;
}

function CheckList({ items, muted = false }: { items: readonly string[]; muted?: boolean }) {
  return <ul className={muted ? styles.mutedList : styles.checkList}>{items.map((item) => <li key={item}><Check aria-hidden="true" size={16} /><span>{item}</span></li>)}</ul>;
}

function MatchingVisualization({ locale }: { locale: Locale }) {
  const isHy = locale === "hy";
  return (
    <div className={styles.matchVisual} aria-label={isHy ? "Սովորողների համադրման պատկեր" : "Student matching visualization"}>
      <div className={styles.visualHeader}><span><Network size={15} /> {isHy ? "Համադրման քարտեզ" : "Matching map"}</span><span className={styles.liveStatus}><i /> {isHy ? "Ստուգվում է" : "Comparing fit"}</span></div>
      <svg className={styles.matchLines} viewBox="0 0 620 440" aria-hidden="true"><path className={styles.lineOne} d="M132 113 C238 120 245 205 310 221" /><path className={styles.lineTwo} d="M485 106 C391 116 387 195 310 221" /><path className={styles.lineWait} d="M492 353 C420 337 402 286 365 255" /><circle cx="310" cy="221" r="6" /></svg>
      <article className={`${styles.studentNode} ${styles.studentA}`}><span className={styles.avatar}>AM</span><div><strong>Aram</strong><small>{isHy ? "6-րդ դասարան · Կոտորակներ" : "Grade 6 · Fractions"}</small></div><span className={styles.nodeTag}>{isHy ? "Երեկոյան" : "Weekday evenings"}</span></article>
      <article className={`${styles.studentNode} ${styles.studentB}`}><span className={styles.avatar}>MK</span><div><strong>Maya</strong><small>{isHy ? "6-րդ դասարան · Կոտորակներ" : "Grade 6 · Fractions"}</small></div><span className={styles.nodeTag}>{isHy ? "Երեկոյան" : "Weekday evenings"}</span></article>
      <article className={`${styles.studentNode} ${styles.studentC}`}><span className={`${styles.avatar} ${styles.waitAvatar}`}>LN</span><div><strong>Lena</strong><small>{isHy ? "7-րդ դասարան · Կրկնություն" : "Grade 7 · Fractions review"}</small></div><span className={`${styles.nodeTag} ${styles.waitTag}`}>{isHy ? "Այլ ժամ" : "Different schedule"}</span></article>
      <div className={styles.lessonHub}><span className={styles.tutorAvatar}><UserRoundCheck size={22} /></span><small>{isHy ? "Ստուգված դասավանդող" : "Verified tutor"}</small><strong>{isHy ? "Խումբը համադրված է" : "Group match found"}</strong><div><span><Check size={12} /> {isHy ? "Թեմա" : "Same topic"}</span><span><Check size={12} /> {isHy ? "Մակարդակ" : "Similar level"}</span><span><Check size={12} /> {isHy ? "Ժամեր" : "Compatible time"}</span></div></div>
      <div className={styles.waitingLabel}><Clock3 size={14} /><span><strong>{isHy ? "Սպասման ցանկում" : "Waiting list"}</strong><small>{isHy ? "Ժամերը դեռ չեն համընկնում" : "Schedule does not align yet"}</small></span></div>
    </div>
  );
}

const benefitIcons: LucideIcon[] = [Lightbulb, MessageCircleMore, Target, Network];

function ClassroomPreview({ c, locale }: { c: GroupCopy["classroom"]; locale: Locale }) {
  const hy = locale === "hy";
  return <div className={styles.classroomFrame} aria-label={c.title}><div className={styles.classroomTop}><span><i /> {hy ? "Ուղիղ · Կոտորակներ" : "Live · Fractions clinic"}</span><span>42:18</span></div><div className={styles.classroomBody}><div className={styles.videoRail}><div className={styles.tutorVideo}><span>AS</span><small><ShieldCheck size={12} /> {hy ? "Աննա · Դասավանդող" : "Anna · Tutor"}</small></div>{["AM", "MK", "RJ"].map((name, index) => <div className={styles.studentVideo} key={name}><span>{name}</span><small>{index === 1 && <Hand size={12} />} {index === 1 ? (hy ? "Ձեռք է բարձրացրել" : "Hand raised") : (hy ? "Աշխատում է" : "Working")}</small></div>)}</div><div className={styles.whiteboard}><div className={styles.boardHeader}><span><PencilLine size={14} /> {hy ? "Ընդհանուր գրատախտակ" : "Shared whiteboard"}</span><span>{hy ? "Օրինակ 03" : "Example 03"}</span></div><div className={styles.fractionProblem}><span>3/4</span><i>+</i><span>1/8</span><i>=</i><strong>?</strong></div><p>{hy ? "Գտեք ընդհանուր հայտարարը և բացատրեք՝ ինչու է այն աշխատում։" : "Find a common denominator. Explain why it works."}</p><div className={styles.responses}><span>Maya: 6/8 + 1/8</span><span>{hy ? "Արամ․ մասերը պետք է նույն չափն ունենան։" : "Aram: The pieces must be the same size."}</span></div><div className={styles.boardFooter}><span><CheckCircle2 size={14} /> {hy ? "2 պատասխան ստուգված է" : "2 responses checked"}</span><span><MessageCircleMore size={14} /> {hy ? "Անհատական արձագանքը պատրաստ է" : "Private feedback ready"}</span></div></div></div></div>;
}

function ProgressDashboard({ locale }: { locale: Locale }) {
  const hy = locale === "hy";
  const metrics = [[hy ? "Մասնակցության հավասարակշռություն" : "Participation balance", "Balanced", 84], [hy ? "Հմտության վստահություն" : "Skill confidence", "Growing", 72], [hy ? "Տնային աշխատանք" : "Homework status", "3 / 3", 100]] as const;
  return <div className={styles.progressPanel}><div className={styles.progressHeader}><span><BarChart3 size={16} /> {hy ? "Խմբի ուշադրության վահանակ" : "Group attention dashboard"}</span><span>Week 06</span></div><div className={styles.learnerTabs}><span data-active="true">Maya</span><span>Aram</span><span>Rafi</span></div><div className={styles.metrics}>{metrics.map(([label, value, amount]) => <div className={styles.metric} key={label}><div><span>{label}</span><strong>{value}</strong></div><i><b style={{ width: `${amount}%` }} /></i></div>)}</div><div className={styles.privateNote}><LockKeyhole size={16} /><div><strong>{hy ? "Մասնավոր նշում դասավանդողից" : "Private tutor note"}</strong><p>{hy ? "Մայան ճիշտ բացատրեց ընդհանուր հայտարարը։ Հաջորդ դասին ավելացնել բարդությունը։" : "Maya explained the common denominator clearly. Add one stretch problem next lesson."}</p></div></div></div>;
}

function GroupMatchingForm({ locale, c }: { locale: Locale; c: GroupCopy["form"] }) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<FormValues>(initialForm);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
  const hy = locale === "hy";
  const goals = hy ? ["Հասնել բաց թողածը", "Մնալ դասարանի մակարդակին", "Առաջ անցնել", "Պատրաստվել քննության", "Կառուցել վստահություն", "Լուծել բարդ խնդիրներ"] : ["Catch up", "Stay on grade level", "Move ahead", "Prepare for an exam", "Build confidence", "Solve advanced problems"];
  const levels = hy ? ["Հիմքերի աջակցության կարիք ունի", "Մի փոքր ցածր է դասարանի մակարդակից", "Դասարանի մակարդակին է", "Դասարանի մակարդակից բարձր է", "Վստահ չեմ"] : ["Needs foundation support", "Slightly below grade level", "At grade level", "Above grade level", "Not sure"];
  const days = hy ? ["Երկ", "Երք", "Չրք", "Հնգ", "Ուրբ", "Շբթ", "Կիր"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const timeOptions = hy ? ["Առավոտ", "Կեսօրից հետո", "Երեկո", "Ճկուն"] : ["Morning", "Afternoon", "Evening", "Flexible"];
  const canContinue = [Boolean(values.subject && values.grade), Boolean(values.goal), Boolean(values.level), Boolean(values.timezone && values.days.length && values.times), Boolean(values.parentName.trim().length >= 2 && /\S+@\S+\.\S+/.test(values.email)), true][step];
  const subject = subjectOptions.find((item) => item.id === values.subject);
  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const toggleDay = (day: string) => update("days", values.days.includes(day) ? values.days.filter((item) => item !== day) : [...values.days, day]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 5) { if (canContinue) setStep((current) => Math.min(5, current + 1)); return; }
    setStatus("sending");
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "group_matching", parentName: values.parentName, email: values.email, phone: values.phone, learnerAgeBand: null, interest: `Group lessons · ${subject?.en ?? values.subject} · ${values.grade}`, message: JSON.stringify({ topic: values.topic || null, goal: values.goal, currentLevel: values.level, timezone: values.timezone, preferredDays: values.days, preferredTimeRange: values.times, scheduleFlexibility: values.flexibility }), locale, privacyConsent: formData.get("privacyConsent") === "on", company: "" }) });
    if (response.ok) { setStatus("sent"); setSubmittedAt(new Date()); } else setStatus("error");
  }
  if (status === "sent") return <div className={styles.successState} role="status"><span className={styles.successIcon}><Check size={28} /></span><p className={styles.eyebrow}>{c.status}</p><h3>{c.submitted}</h3><p>{c.submittedBody}</p><dl><div><dt>{c.subject}</dt><dd>{subject?.[locale] ?? values.subject}</dd></div><div><dt>{c.level}</dt><dd>{values.grade} · {values.level}</dd></div><div><dt>{c.days}</dt><dd>{values.days.join(", ")} · {values.times}</dd></div><div><dt>{c.submittedDate}</dt><dd>{submittedAt?.toLocaleDateString(locale === "hy" ? "hy-AM" : "en-US")}</dd></div></dl><div className={styles.formActions}><button className={styles.secondaryButton} type="button" onClick={() => { setValues(initialForm); setStep(0); setStatus("idle"); }}>{c.update}<RefreshCcw size={16} /></button><ButtonLink href={localHref(locale, "/consultation")}>{c.consult}</ButtonLink></div></div>;
  return <form className={styles.matchForm} onSubmit={submit}><ol className={styles.stepper} aria-label={c.title}>{c.steps.map((label, index) => <li data-active={index === step} data-complete={index < step} key={label}><button aria-current={index === step ? "step" : undefined} disabled={index > step} onClick={() => index < step && setStep(index)} type="button"><span>{index < step ? <Check size={14} /> : index + 1}</span><small>{label}</small></button></li>)}</ol><div className={styles.formStage} aria-live="polite">
    {step === 0 && <fieldset><legend>{c.steps[0]}</legend><div className={styles.fieldGrid}><label><span>{c.subject}</span><select value={values.subject} onChange={(e) => update("subject", e.target.value)} required><option value="">{hy ? "Ընտրել առարկան" : "Choose a subject"}</option>{subjectOptions.map((item) => <option value={item.id} key={item.id}>{item[locale]}</option>)}</select></label><label><span>{c.grade}</span><input value={values.grade} onChange={(e) => update("grade", e.target.value)} placeholder={hy ? "օր․ 7-րդ դասարան" : "e.g. Grade 7 or Algebra I"} required maxLength={80} /></label></div><label><span>{c.topic}</span><input value={values.topic} onChange={(e) => update("topic", e.target.value)} placeholder={hy ? "Կոտորակներ, հանրահաշիվ կամ վստահ չեմ" : "Fractions, algebra, general support, or not sure"} maxLength={120} /></label></fieldset>}
    {step === 1 && <ChoiceField legend={c.goal} options={goals} value={values.goal} onChange={(value) => update("goal", value)} />}
    {step === 2 && <ChoiceField legend={c.level} options={levels} value={values.level} onChange={(value) => update("level", value)} />}
    {step === 3 && <fieldset><legend>{c.steps[3]}</legend><label><span>{c.timezone}</span><input value={values.timezone} onChange={(e) => update("timezone", e.target.value)} required /></label><span className={styles.fieldLabel}>{c.days}</span><div className={styles.dayPicker}>{days.map((day) => <button aria-pressed={values.days.includes(day)} type="button" key={day} onClick={() => toggleDay(day)}>{day}</button>)}</div><span className={styles.fieldLabel}>{c.times}</span><div className={styles.choiceGrid}>{timeOptions.map((time) => <button aria-pressed={values.times === time} type="button" key={time} onClick={() => update("times", time)}>{time}</button>)}</div><label><span>{c.flexibility}</span><select value={values.flexibility} onChange={(e) => update("flexibility", e.target.value)}><option value="low">{hy ? "Ցածր" : "Low"}</option><option value="medium">{hy ? "Միջին" : "Medium"}</option><option value="high">{hy ? "Բարձր" : "High"}</option></select></label><p className={styles.formHint}><Clock3 size={15} />{c.flexibleHint}</p></fieldset>}
    {step === 4 && <fieldset><legend>{c.steps[4]}</legend><div className={styles.fieldGrid}><label><span>{c.parentName}</span><input autoComplete="name" value={values.parentName} onChange={(e) => update("parentName", e.target.value)} required maxLength={120} /></label><label><span>{c.email}</span><input autoComplete="email" type="email" value={values.email} onChange={(e) => update("email", e.target.value)} required maxLength={254} /></label></div><label><span>{c.phone}</span><input autoComplete="tel" type="tel" value={values.phone} onChange={(e) => update("phone", e.target.value)} maxLength={40} /></label></fieldset>}
    {step === 5 && <fieldset><legend>{c.summary}</legend><dl className={styles.reviewList}><div><dt>{c.subject}</dt><dd>{subject?.[locale]} · {values.grade}{values.topic ? ` · ${values.topic}` : ""}</dd></div><div><dt>{c.goal}</dt><dd>{values.goal}</dd></div><div><dt>{c.level}</dt><dd>{values.level}</dd></div><div><dt>{c.days}</dt><dd>{values.days.join(", ")} · {values.times} · {values.timezone}</dd></div><div><dt>{c.parentName}</dt><dd>{values.parentName} · {values.email}</dd></div></dl><label className={styles.consent}><input name="privacyConsent" type="checkbox" required /><span>{c.consent} <Link href={localHref(locale, "/privacy")}>{hy ? "Կարդալ քաղաքականությունը" : "Read the policy"}</Link></span></label><p className={styles.formHint}><CircleAlert size={15} />{c.noGuarantee}</p>{status === "error" && <p className={styles.formError} role="alert">{c.error}</p>}</fieldset>}
  </div><div className={styles.formNav}>{step > 0 && <button className={styles.formBack} onClick={() => setStep((current) => Math.max(0, current - 1))} type="button">{c.back}</button>}<button className={styles.formNext} disabled={!canContinue || status === "sending"} type="submit">{step === 5 ? (status === "sending" ? c.sending : c.submit) : c.next}<ArrowRight size={16} /></button></div></form>;
}

function ChoiceField({ legend, options, value, onChange }: { legend: string; options: readonly string[]; value: string; onChange: (value: string) => void }) {
  return <fieldset><legend>{legend}</legend><div className={styles.choiceGrid}>{options.map((option) => <button aria-pressed={value === option} type="button" key={option} onClick={() => onChange(option)}>{option}{value === option && <Check size={15} />}</button>)}</div></fieldset>;
}

export function GroupLessonsPage({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const consultationHref = localHref(locale, "/consultation");
  const formHref = "#matching-form";
  const subjectCards = useMemo(() => subjectOptions.map((item) => ({ ...item, name: item[locale] })), [locale]);
  return <div className={`${styles.page} ${displayFont.variable} ${bodyFont.variable}`}>
    <main>
      <section className={styles.hero}><div className={styles.heroGrid} aria-hidden="true" /><div className={styles.shell}><div className={styles.heroLayout}><div className={styles.heroCopy}><p className={styles.eyebrow}><span />{c.eyebrow}</p><h1>{c.heroTitle}</h1><p className={styles.heroBody}>{c.heroBody}</p><div className={styles.valueLine}><strong>≈40%</strong><span>{c.saving}</span></div><div className={styles.heroActions}><ButtonLink href={formHref}>{c.primary}</ButtonLink><ButtonLink href="#matching-process" secondary>{c.secondary}</ButtonLink></div><p className={styles.availabilityNote}><Clock3 size={15} />{c.availability}</p><div className={styles.trustRow}>{c.trust.map((item) => <span key={item}><CheckCircle2 size={15} />{item}</span>)}</div></div><MatchingVisualization locale={locale} /></div></div></section>

      <section className={styles.compareSection}><div className={styles.shell}><SectionHeading eyebrow={c.compare.eyebrow} title={c.compare.title} body={c.compare.body} /><div className={styles.compareGrid}><article className={styles.formatCard}><span className={styles.formatIcon}><UserRoundCheck /></span><p className={styles.cardLabel}>01 · 1:1</p><h3>{c.compare.individual}</h3><CheckList items={c.compare.individualItems} muted /></article><div className={styles.compareVs}>or</div><article className={`${styles.formatCard} ${styles.groupFormat}`}><span className={styles.savingBadge}>{c.compare.badge}</span><span className={styles.formatIcon}><Users /></span><p className={styles.cardLabel}>02 · {GROUP_SIZE_RANGE.minimum}–{GROUP_SIZE_RANGE.maximum}</p><h3>{c.compare.group}</h3><CheckList items={c.compare.groupItems} /></article></div><p className={styles.centerNote}>{c.compare.note}</p></div></section>

      <section className={styles.processSection} id="matching-process"><div className={styles.shell}><SectionHeading eyebrow={c.process.eyebrow} title={c.process.title} body={c.process.body} /><ol className={styles.processLine}>{c.process.steps.map(([title, body], index) => <li key={title}><span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></div></section>

      <section className={styles.criteriaSection}><div className={styles.shell}><div className={styles.split}><div><SectionHeading eyebrow={c.criteria.eyebrow} title={c.criteria.title} body={c.criteria.body} /><blockquote>{c.criteria.example}</blockquote><div className={styles.factorRail}>{c.criteria.factors.map((factor) => <span key={factor}>{factor}</span>)}</div></div><div className={styles.matchMatrix}><div className={styles.matrixHeader}><span>{locale === "hy" ? "Համադրման ազդանշան" : "Match signal"}</span><span>{locale === "hy" ? "Համատեղելի" : "Compatible"}</span></div><article><span className={styles.matrixIconGood}><Check /></span><div><h3>{c.criteria.strong}</h3><CheckList items={c.criteria.strongItems} /></div></article><article className={styles.weakMatch}><span className={styles.matrixIconWeak}><CircleAlert /></span><div><h3>{c.criteria.weak}</h3><CheckList items={c.criteria.weakItems} muted /></div></article></div></div></div></section>

      <section className={styles.waitSection}><div className={styles.shell}><SectionHeading eyebrow={c.waiting.eyebrow} title={c.waiting.title} body={c.waiting.body} inverse /><div className={styles.statusRail}>{c.waiting.states.map(([title, body, action], index) => <article data-state={index} key={title}><div className={styles.statusTop}><span>{index === 0 ? <CheckCircle2 /> : index === 1 ? <Users /> : <Clock3 />}</span><small>{String(index + 1).padStart(2, "0")}</small></div><h3>{title}</h3><p>{body}</p><span className={styles.statusAction}>{action}<ArrowRight size={14} /></span></article>)}</div><p className={styles.waitOptions}>{c.waiting.options}</p></div></section>

      <section className={styles.classroomSection}><div className={styles.shell}><div className={styles.classroomLayout}><div><SectionHeading eyebrow={c.classroom.eyebrow} title={c.classroom.title} body={c.classroom.body} /><ol className={styles.lessonTimeline}>{c.classroom.timeline.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol></div><ClassroomPreview c={c.classroom} locale={locale} /></div></div></section>

      <section className={styles.benefitsSection}><div className={styles.shell}><SectionHeading eyebrow={c.benefits.eyebrow} title={c.benefits.title} /><div className={styles.benefitGrid}>{c.benefits.items.map(([title, body], index) => { const Icon = benefitIcons[index] ?? Sparkles; return <article key={title}><span><Icon /></span><h3>{title}</h3><p>{body}</p></article>; })}</div></div></section>

      <section className={styles.attentionSection}><div className={styles.shell}><div className={styles.split}><div><SectionHeading eyebrow={c.attention.eyebrow} title={c.attention.title} body={c.attention.body} /><ul className={styles.attentionChecks}><li><CheckCircle2 />{locale === "hy" ? "Յուրաքանչյուր սովորող ստանում է անհատական հերթեր" : "Every student receives individual turns"}</li><li><BookOpenCheck />{locale === "hy" ? "Տնային աշխատանքը հետևվում է անհատապես" : "Homework is tracked per learner"}</li><li><MessageCircleMore />{locale === "hy" ? "Ծնողները ստանում են անհատական արձագանք" : "Parents receive student-specific feedback"}</li></ul><p className={styles.adaptiveNote}><RefreshCcw size={18} />{c.attention.note}</p></div><ProgressDashboard locale={locale} /></div></div></section>

      <section className={styles.pricingSection}><div className={styles.shell}><div className={styles.pricingLayout}><SectionHeading eyebrow={c.pricing.eyebrow} title={c.pricing.title} body={c.pricing.body} /><div className={styles.pricingCard}><div><span>{c.pricing.individual}</span><strong>{c.pricing.individualPrice}</strong><small>{locale === "hy" ? "1 սովորող · անհատական տեմպ" : "1 learner · individual pace"}</small></div><span className={styles.priceArrow}><ArrowRight /></span><div className={styles.groupPrice}><span>{c.pricing.group}</span><strong>{c.pricing.groupPrice}</strong><small>{locale === "hy" ? `${GROUP_SIZE_RANGE.minimum}–${GROUP_SIZE_RANGE.maximum} սովորող · ընդհանուր թեմա` : `${GROUP_SIZE_RANGE.minimum}–${GROUP_SIZE_RANGE.maximum} learners · shared topic`}</small><em>{c.pricing.saving}</em></div><p><CircleAlert size={14} />{c.pricing.note}</p></div></div></div></section>

      <section className={styles.suitabilitySection}><div className={styles.shell}><SectionHeading eyebrow={c.suitability.eyebrow} title={c.suitability.title} /><div className={styles.suitabilityGrid}><article><span className={styles.fitIcon}><Users /></span><h3>{c.suitability.group}</h3><CheckList items={c.suitability.groupItems} /></article><article><span className={styles.oneIcon}><UserRoundCheck /></span><h3>{c.suitability.individual}</h3><CheckList items={c.suitability.individualItems} muted /></article></div><div className={styles.centerAction}><ButtonLink href={consultationHref} secondary>{c.suitability.cta}</ButtonLink></div></div></section>

      <section className={styles.subjectsSection}><div className={styles.shell}><SectionHeading eyebrow={c.subjects.eyebrow} title={c.subjects.title} body={c.subjects.body} /><div className={styles.subjectRail}>{subjectCards.map((subject, index) => <article key={subject.id}><span className={styles.subjectIndex}>{String(index + 1).padStart(2, "0")}</span><h3>{subject.name}</h3><strong>{subject.range[locale]}</strong><p>{subject.topics[locale]}</p><Link href={formHref}>{c.subjects.cta}<ArrowRight size={15} /></Link></article>)}</div></div></section>

      <section className={styles.formSection} id="matching-form"><div className={styles.shell}><div className={styles.formLayout}><div className={styles.formIntro}><SectionHeading eyebrow={c.form.eyebrow} title={c.form.title} body={c.form.body} inverse /><div className={styles.formAssurance}><ShieldCheck /><div><strong>{locale === "hy" ? "Համադրում՝ առանց կեղծ շտապողականության" : "Matching without false urgency"}</strong><p>{locale === "hy" ? "Ձեր տվյալներն օգնում են մեզ ստուգել իրական համատեղելիությունը։ Վատ համադրումը չենք պարտադրում։" : "Your details help us check genuine compatibility. We do not force a poor-fit placement."}</p></div></div></div><GroupMatchingForm locale={locale} c={c.form} /></div></div></section>

      <section className={styles.faqSection}><div className={styles.shell}><SectionHeading eyebrow={c.faq.eyebrow} title={c.faq.title} /><div className={styles.faqList}>{c.faq.items.map(([question, answer]) => <details key={question}><summary><span>{question}</span><ChevronDown aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></div></section>

      <section className={styles.finalSection}><div className={styles.shell}><div className={styles.finalCta}><span className={styles.finalNetwork} aria-hidden="true"><i /><i /><i /><Network /></span><div><h2>{c.final.title}</h2><p>{c.final.body}</p><div className={styles.heroActions}><ButtonLink href={formHref}>{c.primary}</ButtonLink><ButtonLink href={consultationHref} secondary>{c.consultation}</ButtonLink></div><small><ShieldCheck size={14} />{c.final.note}</small></div></div></div></section>
    </main>
    <div className={styles.mobileSticky}><Link href={formHref}>{c.primary}<ArrowRight size={16} /></Link></div>
  </div>;
}
