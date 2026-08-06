import type { Locale } from "@app/i18n/config";

export const pageSlugs = [
  "how-it-works",
  "mathematics",
  "programming",
  "armenian-language-heritage",
  "chess",
  "sat",
  "toefl",
  "group-lessons",
  "project-based-learning",
  "parents",
  "tutors",
  "pricing",
  "consultation",
  "free-assessment",
  "safety",
  "privacy",
  "faq",
  "contact",
  "terms",
  "tutor-application",
] as const;
export type MarketingSlug = (typeof pageSlugs)[number];

export function faqJsonLd(locale: Locale) {
  const items =
    locale === "hy"
      ? [
          [
            "Ինչպե՞ս է սկսվում ուսուցումը",
            "Սկսում ենք անվճար զրույցից և ըստ կարիքի՝ կարճ գնահատումից։",
          ],
          [
            "Խմբերը մեծ ե՞ն",
            "Խմբերը փոքր են, որպեսզի յուրաքանչյուր սովորող ստանա հստակ հետադարձ կապ։",
          ],
          [
            "Ի՞նչ տվյալներ եք հավաքում",
            "Միայն կապ հաստատելու և զրույցը կազմակերպելու համար անհրաժեշտ տվյալները։",
          ],
          [
            "Կարո՞ղ եմ հարց տալ մինչև գրանցվելը",
            "Այո, ուղարկեք հաղորդագրություն, և թիմը կպատասխանի։",
          ],
        ]
      : [
          [
            "How does learning start?",
            "We begin with a free conversation and, when useful, a short assessment.",
          ],
          ["Are groups large?", "Groups stay small so each learner can receive clear feedback."],
          [
            "What information do you collect?",
            "Only what is needed to contact you and arrange the conversation.",
          ],
          [
            "Can I ask a question before enrolling?",
            "Yes. Send a message and the team will reply.",
          ],
        ];
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([name, text]) => ({
      "@type": "Question",
      name,
      acceptedAnswer: { "@type": "Answer", text },
    })),
  };
}
