import { createHash, createHmac } from "node:crypto";

export type TransactionalEmail = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  tags?: Record<string, string>;
};

export type EmailDelivery = { providerId?: string };
export type EmailProvider = { send(email: TransactionalEmail): Promise<EmailDelivery> };
export type FetchLike = typeof fetch;

export type ResendConfig = { kind: "resend"; apiKey: string };
export type SesConfig = {
  kind: "ses";
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
};
export type EmailProviderConfig = ResendConfig | SesConfig;

function assertEmail(email: TransactionalEmail): void {
  if (!email.from || !email.to || !email.subject || !email.text) {
    throw new Error("Transactional email requires from, to, subject, and text.");
  }
  if (email.subject.includes("{") || email.subject.includes("}")) {
    throw new Error("Email subject contains an unresolved template variable.");
  }
}

function toHex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function awsSigningKey(secret: string, date: string, region: string): Buffer {
  const dateKey = hmac(`AWS4${secret}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "ses");
  return hmac(serviceKey, "aws4_request");
}

export function createEmailProvider(
  config: EmailProviderConfig,
  fetcher: FetchLike = fetch,
): EmailProvider {
  if (config.kind === "resend") {
    return {
      async send(email) {
        assertEmail(email);
        const response = await fetcher("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: email.from,
            to: [email.to],
            subject: email.subject,
            text: email.text,
            html: email.html,
            reply_to: email.replyTo,
            tags: email.tags
              ? Object.entries(email.tags).map(([name, value]) => ({ name, value }))
              : undefined,
          }),
        });
        if (!response.ok) throw new Error(`Resend rejected email (${response.status}).`);
        const result = (await response.json()) as { id?: string };
        return { providerId: result.id };
      },
    };
  }

  return {
    async send(email) {
      assertEmail(email);
      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
      const date = amzDate.slice(0, 8);
      const host = `email.${config.region}.amazonaws.com`;
      const body = JSON.stringify({
        FromEmailAddress: email.from,
        Destination: { ToAddresses: [email.to] },
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: "UTF-8" },
            Body: {
              Text: { Data: email.text, Charset: "UTF-8" },
              ...(email.html ? { Html: { Data: email.html, Charset: "UTF-8" } } : {}),
            },
          },
        },
        ...(email.replyTo ? { ReplyToAddresses: [email.replyTo] } : {}),
        ...(email.tags
          ? { EmailTags: Object.entries(email.tags).map(([Name, Value]) => ({ Name, Value })) }
          : {}),
      });
      const payloadHash = toHex(body);
      const credentialScope = `${date}/${config.region}/ses/aws4_request`;
      const headers: Record<string, string> = {
        "content-type": "application/json",
        host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
      };
      if (config.sessionToken) headers["x-amz-security-token"] = config.sessionToken;
      const signedHeaders = Object.keys(headers).sort();
      const canonicalHeaders = signedHeaders.map((key) => `${key}:${headers[key]}\n`).join("");
      const canonicalRequest = [
        "POST",
        "/v2/email/outbound-emails",
        "",
        canonicalHeaders,
        signedHeaders.join(";"),
        payloadHash,
      ].join("\n");
      const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        toHex(canonicalRequest),
      ].join("\n");
      const signature = createHmac(
        "sha256",
        awsSigningKey(config.secretAccessKey, date, config.region),
      )
        .update(stringToSign)
        .digest("hex");
      headers.authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`;
      const response = await fetcher(`https://${host}/v2/email/outbound-emails`, {
        method: "POST",
        headers,
        body,
      });
      if (!response.ok) throw new Error(`Amazon SES rejected email (${response.status}).`);
      const result = (await response.json()) as { MessageId?: string };
      return { providerId: result.MessageId };
    },
  };
}

export async function sendTestEmail(
  provider: EmailProvider,
  email: TransactionalEmail,
): Promise<EmailDelivery> {
  return provider.send({ ...email, tags: { ...email.tags, purpose: "notification-test" } });
}
