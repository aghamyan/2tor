import { z } from "zod";

export const notificationTypes = [
  "verification",
  "consent_status",
  "security_change",
  "lesson_scheduled",
  "lesson_canceled",
  "payment_receipt",
  "payment_failure",
  "payment_refund",
  "privacy_request",
  "safety_notice",
  "lesson_reminder",
  "progress_update",
  "promotional",
] as const;

export type NotificationType = (typeof notificationTypes)[number];
export type TemplateLocale = "en" | "hy";
export type TemplateAudience = "default" | "child";
export type TemplateData = Record<string, unknown>;

export type RenderedNotification = {
  version: number;
  title: string;
  body: string;
  emailSubject: string;
  emailText: string;
};

type TemplateDefinition = {
  version: number;
  variables: readonly string[];
  render: (
    locale: TemplateLocale,
    data: Record<string, string>,
    audience: TemplateAudience,
  ) => RenderedNotification;
};

const stringData = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

const messages: Record<
  TemplateLocale,
  Record<NotificationType, { title: string; body: string; subject: string }>
> = {
  en: {
    verification: {
      title: "Verify your account",
      body: "Please verify your account: {actionUrl}",
      subject: "Action needed for your account",
    },
    consent_status: {
      title: "Consent status updated",
      body: "Your consent status is now {status}.",
      subject: "Your consent status was updated",
    },
    security_change: {
      title: "Security update",
      body: "A security setting changed. Review it here: {actionUrl}",
      subject: "Security update for your account",
    },
    lesson_scheduled: {
      title: "Lesson scheduled",
      body: "Your lesson is scheduled. View the details: {actionUrl}",
      subject: "Your schedule was updated",
    },
    lesson_canceled: {
      title: "Lesson canceled",
      body: "A lesson was canceled. View your schedule: {actionUrl}",
      subject: "Your schedule was updated",
    },
    payment_receipt: {
      title: "Payment receipt",
      body: "We received your payment of {amount} {currency}.",
      subject: "Your payment receipt",
    },
    payment_failure: {
      title: "Payment needs attention",
      body: "We could not process a payment of {amount} {currency}. Update payment details: {actionUrl}",
      subject: "Action needed for your payment",
    },
    payment_refund: {
      title: "Refund issued",
      body: "A refund of {amount} {currency} has been issued.",
      subject: "Your refund confirmation",
    },
    privacy_request: {
      title: "Privacy request update",
      body: "Your privacy request status is {status}. Review it here: {actionUrl}",
      subject: "Your privacy request was updated",
    },
    safety_notice: {
      title: "Important account notice",
      body: "Please review this important notice: {actionUrl}",
      subject: "Important account notice",
    },
    lesson_reminder: {
      title: "Upcoming lesson",
      body: "You have an upcoming lesson. View your schedule: {actionUrl}",
      subject: "Lesson reminder",
    },
    progress_update: {
      title: "Progress update",
      body: "There is a new progress update. View it here: {actionUrl}",
      subject: "New progress update",
    },
    promotional: {
      title: "News from 2tor",
      body: "{message} Learn more: {actionUrl}",
      subject: "News from 2tor",
    },
  },
  hy: {
    verification: {
      title: "Հաստատեք ձեր հաշիվը",
      body: "Խնդրում ենք հաստատել ձեր հաշիվը՝ {actionUrl}",
      subject: "Ձեր հաշվի համար անհրաժեշտ գործողություն",
    },
    consent_status: {
      title: "Համաձայնության կարգավիճակը թարմացվել է",
      body: "Ձեր համաձայնության կարգավիճակն այժմ {status} է։",
      subject: "Ձեր համաձայնության կարգավիճակը թարմացվել է",
    },
    security_change: {
      title: "Անվտանգության թարմացում",
      body: "Անվտանգության կարգավորումը փոխվել է։ Ստուգեք այստեղ՝ {actionUrl}",
      subject: "Ձեր հաշվի անվտանգության թարմացում",
    },
    lesson_scheduled: {
      title: "Դասը նշանակվել է",
      body: "Ձեր դասը նշանակվել է։ Տեսեք մանրամասները՝ {actionUrl}",
      subject: "Ձեր ժամանակացույցը թարմացվել է",
    },
    lesson_canceled: {
      title: "Դասը չեղարկվել է",
      body: "Դասը չեղարկվել է։ Տեսեք ժամանակացույցը՝ {actionUrl}",
      subject: "Ձեր ժամանակացույցը թարմացվել է",
    },
    payment_receipt: {
      title: "Վճարման անդորրագիր",
      body: "Մենք ստացել ենք ձեր {amount} {currency} վճարումը։",
      subject: "Ձեր վճարման անդորրագիրը",
    },
    payment_failure: {
      title: "Վճարումը ուշադրության կարիք ունի",
      body: "Չհաջողվեց մշակել {amount} {currency} վճարումը։ Թարմացրեք վճարման տվյալները՝ {actionUrl}",
      subject: "Անհրաժեշտ գործողություն ձեր վճարման համար",
    },
    payment_refund: {
      title: "Գումարի վերադարձ է կատարվել",
      body: "{amount} {currency} գումարի վերադարձ է կատարվել։",
      subject: "Ձեր գումարի վերադարձի հաստատում",
    },
    privacy_request: {
      title: "Գաղտնիության հարցման թարմացում",
      body: "Ձեր գաղտնիության հարցման կարգավիճակը {status} է։ Դիտեք այստեղ՝ {actionUrl}",
      subject: "Ձեր գաղտնիության հարցումը թարմացվել է",
    },
    safety_notice: {
      title: "Կարևոր ծանուցում",
      body: "Խնդրում ենք դիտել այս կարևոր ծանուցումը՝ {actionUrl}",
      subject: "Կարևոր ծանուցում ձեր հաշվի համար",
    },
    lesson_reminder: {
      title: "Առաջիկա դաս",
      body: "Դուք ունեք առաջիկա դաս։ Տեսեք ժամանակացույցը՝ {actionUrl}",
      subject: "Դասի հիշեցում",
    },
    progress_update: {
      title: "Առաջընթացի թարմացում",
      body: "Կա առաջընթացի նոր թարմացում։ Դիտեք այստեղ՝ {actionUrl}",
      subject: "Առաջընթացի նոր թարմացում",
    },
    promotional: {
      title: "Նորություններ 2tor-ից",
      body: "{message} Իմացեք ավելին՝ {actionUrl}",
      subject: "Նորություններ 2tor-ից",
    },
  },
};

const requirements: Record<NotificationType, readonly string[]> = {
  verification: ["actionUrl"],
  consent_status: ["status"],
  security_change: ["actionUrl"],
  lesson_scheduled: ["actionUrl"],
  lesson_canceled: ["actionUrl"],
  payment_receipt: ["amount", "currency"],
  payment_failure: ["amount", "currency", "actionUrl"],
  payment_refund: ["amount", "currency"],
  privacy_request: ["status", "actionUrl"],
  safety_notice: ["actionUrl"],
  lesson_reminder: ["actionUrl"],
  progress_update: ["actionUrl"],
  promotional: ["message", "actionUrl"],
};

function interpolate(value: string, data: Record<string, string>): string {
  return value.replace(/\{([^}]+)\}/g, (_match, key: string) => data[key] ?? `{${key}}`);
}

function definition(type: NotificationType): TemplateDefinition {
  return {
    version: 1,
    variables: requirements[type],
    render(locale, data, audience) {
      const message = messages[locale][type];
      const childPrefix =
        audience === "child" && type === "safety_notice"
          ? locale === "hy"
            ? "Կարևոր․ "
            : "Important: "
          : "";
      return {
        version: 1,
        title: childPrefix + interpolate(message.title, data),
        body: interpolate(message.body, data),
        // Subjects have no domain/detail variables: never place lesson or academic details here.
        emailSubject: interpolate(message.subject, data),
        emailText: interpolate(message.body, data),
      };
    },
  };
}

export function renderNotificationTemplate(
  type: NotificationType,
  locale: TemplateLocale,
  data: TemplateData,
  audience: TemplateAudience = "default",
): RenderedNotification {
  const parsed = stringData.safeParse(data);
  if (!parsed.success) throw new Error(`Invalid variables for notification template "${type}".`);
  const variables = Object.fromEntries(
    Object.entries(parsed.data).map(([key, value]) => [key, String(value)]),
  );
  const template = definition(type);
  const missing = template.variables.filter((key) => !variables[key]?.trim());
  if (missing.length > 0)
    throw new Error(
      `Notification template "${type}" v${template.version} is missing variable(s): ${missing.join(", ")}.`,
    );
  const rendered = template.render(locale, variables, audience);
  if (/\{[^}]+\}/.test(`${rendered.title}\n${rendered.body}\n${rendered.emailSubject}`)) {
    throw new Error(
      `Notification template "${type}" v${template.version} has unresolved variables.`,
    );
  }
  return rendered;
}
