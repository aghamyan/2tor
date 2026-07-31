import type { LessonEarningEvent, LessonEarningSource, LessonEarningSourceFilter } from "./models";
import { lessonEarningEventSchema, lessonEarningSourceFilterSchema } from "./schemas";

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Phase-2 fallback while D5's completed/chargeable lesson feed is not merged. The fixture shape
 * is the production boundary shape, so replacing this adapter does not change payout services.
 */
export function createFixtureLessonEarningSource(
  fixtures: readonly LessonEarningEvent[],
): LessonEarningSource {
  const validated = fixtures.map((fixture) => lessonEarningEventSchema.parse(fixture));
  return {
    async listLessonEarningEvents(
      rawFilter: LessonEarningSourceFilter,
    ): Promise<LessonEarningEvent[]> {
      const filter = lessonEarningSourceFilterSchema.parse(rawFilter);
      return validated.filter((fixture) => {
        const earnedOn = dateOnly(fixture.earnedAt);
        return earnedOn >= filter.periodStart && earnedOn <= filter.periodEnd;
      });
    },
  };
}
