export const REPORTING_METRIC_DEFINITIONS = {
  funnel: {
    visitor: "Unique rotating first-party subject keys with a visitor event in the period.",
    consultation: "Visitor cohort members who subsequently reached a consultation.",
    trial: "Consultation cohort members who subsequently attended a trial.",
    paid: "Trial cohort members who subsequently completed a first payment.",
    retained_30d: "Paid cohort members with a qualifying active event at or after day 30.",
    retained_90d: "Paid cohort members with a qualifying active event at or after day 90.",
  },
  operational: {
    tutorAttendanceRate:
      "Lessons with a tutor join record divided by lessons where a tutor was expected.",
    studentAttendanceRate:
      "Present or late student attendance records divided by expected student places.",
    missingFeedbackRate:
      "Completed lessons without published feedback divided by completed lessons.",
    cancellationRate: "Canceled lessons divided by lessons due in the period.",
    supportResolutionRate:
      "Support tickets opened in the period that reached resolved/closed status.",
    supportResolutionHours:
      "Mean elapsed hours from ticket creation to resolution for resolved tickets.",
    utilizationRate: "Delivered lesson minutes divided by recorded tutor-availability minutes.",
    marginPerLesson: "Mean captured lesson revenue less tutor earning, separated by currency.",
    paymentFailureRate: "Failed charge attempts divided by completed or failed charge attempts.",
    refundRate: "Completed refunds divided by successful payment attempts.",
  },
  academic: {
    baselineScore:
      "Mean first diagnostic score for learners with a later diagnostic in the period.",
    followUpScore: "Mean latest diagnostic score for learners with a baseline in the period.",
    baselineToFollowUpChange:
      "Mean learner-level follow-up minus baseline percentage-point change.",
    milestoneCompletionRate: "Completed milestones divided by milestones included in the period.",
    planProgressRate: "Completed learning-plan items divided by all learning-plan items.",
    accuracyTrend: "Mean learner-level latest minus first normalized assessment accuracy.",
    rubricImprovement: "Mean learner-and-criterion latest minus first normalized rubric score.",
    selfReportedSchoolPerformance:
      "Mean learner-reported school-performance value. This is explicitly self-reported, not an observed or predicted grade.",
  },
} as const;
