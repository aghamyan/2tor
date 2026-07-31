import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  createPublicKey,
  createSign,
  randomBytes,
} from "node:crypto";
import type { PushSubscription } from "./dispatch";

export type VapidConfig = { subject: string; publicKey: string; privateKey: string };
export type WebPushSender = {
  send(
    subscription: PushSubscription,
    payload: { title: string; body: string; url?: string },
  ): Promise<void>;
};

const b64url = (value: Buffer | string) => Buffer.from(value).toString("base64url");
const fromB64url = (value: string) => Buffer.from(value, "base64url");
const hmac = (key: Buffer, value: Buffer | string) =>
  createHmac("sha256", key).update(value).digest();

function hkdf(prk: Buffer, info: string, length: number): Buffer {
  return hmac(prk, Buffer.concat([Buffer.from(info), Buffer.from([1])])).subarray(0, length);
}

function encryptPayload(subscription: PushSubscription, json: string): Buffer {
  const clientPublic = fromB64url(subscription.keys.p256dh);
  const authSecret = fromB64url(subscription.keys.auth);
  const ecdh = createECDH("prime256v1");
  const serverPublic = ecdh.generateKeys();
  const sharedSecret = ecdh.computeSecret(clientPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), clientPublic, serverPublic]);
  const ikm = hmac(authSecret, Buffer.concat([sharedSecret, keyInfo]));
  const salt = randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hkdf(prk, "Content-Encoding: aes128gcm\0", 16);
  const nonce = hkdf(prk, "Content-Encoding: nonce\0", 12);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.concat([Buffer.from(json), Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(serverPublic.length, 20);
  return Buffer.concat([header, serverPublic, encrypted]);
}

function vapidToken(endpoint: string, config: VapidConfig): string {
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = b64url(
    JSON.stringify({
      aud: new URL(endpoint).origin,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: config.subject,
    }),
  );
  const signer = createSign("SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign({
    key: createPrivateKey(config.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${payload}.${b64url(signature)}`;
}

/** Standards-compliant aes128gcm Web Push with VAPID authentication; no SMS channel exists in this MVP. */
export function createVapidPushSender(
  config: VapidConfig,
  fetcher: typeof fetch = fetch,
): WebPushSender {
  return {
    async send(subscription, payload) {
      const publicKey =
        config.publicKey ||
        b64url(
          createPublicKey(config.privateKey).export({ type: "spki", format: "der" }).subarray(-65),
        );
      const response = await fetcher(subscription.endpoint, {
        method: "POST",
        headers: {
          Authorization: `vapid t=${vapidToken(subscription.endpoint, config)}, k=${publicKey}`,
          "Content-Encoding": "aes128gcm",
          "Content-Type": "application/octet-stream",
          TTL: "86400",
        },
        body: encryptPayload(subscription, JSON.stringify(payload)),
      });
      if (!response.ok && response.status !== 201)
        throw new Error(`Web Push rejected notification (${response.status}).`);
    },
  };
}
