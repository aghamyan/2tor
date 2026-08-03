import { describe, expect, it } from "vitest";
import { faqJsonLd, pageSlugs } from "../../components/marketing/seo";

describe("marketing SEO", () => {
  it("publishes all required public paths and FAQPage schema", () => {
    expect(pageSlugs).toEqual(
      expect.arrayContaining([
        "how-it-works",
        "mathematics",
        "programming",
        "armenian-language-heritage",
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
      ]),
    );
    expect(faqJsonLd("en")).toMatchObject({ "@type": "FAQPage" });
  });
});
