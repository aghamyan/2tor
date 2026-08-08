import type { DiscussionAnswerRecord, DiscussionQuestionRecord } from "./models";

/**
 * Confidence-adjusted rating: a lone 5-star rating must not outrank a 4.8-star average built from
 * five ratings (spec: "Do not let one five-star rating automatically dominate all other answers.
 * Use rating count as part of rating confidence."). This is a standard Bayesian-average shrinkage
 * toward a neutral prior (3 stars) — `PRIOR_WEIGHT` is how many "phantom average ratings" a new
 * rating has to outweigh before it moves the confidence score much.
 */
const PRIOR_WEIGHT = 3;
const PRIOR_MEAN = 3;

export function confidenceAdjustedRating(average: number | null, count: number): number {
  if (average === null || count === 0) return PRIOR_MEAN;
  return (count * average + PRIOR_WEIGHT * PRIOR_MEAN) / (count + PRIOR_WEIGHT);
}

/**
 * Answer ordering (spec "ANSWER ORDERING"):
 * 1. Accepted AND tutor-verified
 * 2. Accepted
 * 3. Tutor-verified
 * 4. Highly tutor-rated (confidence-adjusted, not raw average)
 * 5. Official tutor answers
 * 6. Everything else, by helpful count then recency
 *
 * Community helpful-vote popularity never outranks a mathematically verified/accepted answer —
 * it only breaks ties within the same tier.
 */
export function rankAnswer(
  answer: DiscussionAnswerRecord,
  question: Pick<DiscussionQuestionRecord, "acceptedAnswerId">,
  helpfulCount: number,
): number {
  const isAccepted = question.acceptedAnswerId === answer.id;
  const isVerified =
    answer.verificationStatus === "correct" || answer.verificationStatus === "mostly_correct";
  if (isAccepted && isVerified) return 6;
  if (isAccepted) return 5;
  if (isVerified) return 4;
  if (
    answer.tutorRatingCount > 0 &&
    confidenceAdjustedRating(answer.tutorRatingAverage, answer.tutorRatingCount) >= 4
  )
    return 3;
  if (answer.isTutorAnswer) return 2;
  return 1;
}

export function orderAnswersForDisplay(
  answers: readonly DiscussionAnswerRecord[],
  question: Pick<DiscussionQuestionRecord, "acceptedAnswerId">,
  helpfulCounts: ReadonlyMap<string, number>,
): DiscussionAnswerRecord[] {
  return [...answers].sort((a, b) => {
    const tierDiff =
      rankAnswer(b, question, helpfulCounts.get(b.id) ?? 0) -
      rankAnswer(a, question, helpfulCounts.get(a.id) ?? 0);
    if (tierDiff !== 0) return tierDiff;
    const confidenceDiff =
      confidenceAdjustedRating(b.tutorRatingAverage, b.tutorRatingCount) -
      confidenceAdjustedRating(a.tutorRatingAverage, a.tutorRatingCount);
    if (Math.abs(confidenceDiff) > 0.01) return confidenceDiff;
    const helpfulDiff = (helpfulCounts.get(b.id) ?? 0) - (helpfulCounts.get(a.id) ?? 0);
    if (helpfulDiff !== 0) return helpfulDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
