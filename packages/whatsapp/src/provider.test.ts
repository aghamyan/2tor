import { describe, expect, it, vi } from "vitest";

import { createWhatsAppProvider, type FetchLike } from "./provider";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("createWhatsAppProvider — meta_cloud_api", () => {
  const config = {
    kind: "meta_cloud_api" as const,
    accessToken: "test-token",
    phoneNumberId: "1234567890",
  };

  it("sends a 1:1 template message with the expected request shape", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ messages: [{ id: "wamid.abc" }] })) as unknown as FetchLike;
    const provider = createWhatsAppProvider(config, fetcher);

    const delivery = await provider.sendTemplateMessage({
      to: "+15550001111",
      template: "group_invite",
      languageCode: "en",
      variables: ["Alice", "https://chat.whatsapp.com/xyz"],
    });

    expect(delivery.providerMessageId).toBe("wamid.abc");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v25.0/1234567890/messages");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "+15550001111",
      type: "template",
      template: {
        name: "group_invite",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Alice" },
              { type: "text", text: "https://chat.whatsapp.com/xyz" },
            ],
          },
        ],
      },
    });
  });

  it("rejects a template message missing required fields before calling fetch", async () => {
    const fetcher = vi.fn() as unknown as FetchLike;
    const provider = createWhatsAppProvider(config, fetcher);

    await expect(
      provider.sendTemplateMessage({ to: "", template: "group_invite", languageCode: "en", variables: [] }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends a plain-text group message with recipient_type group", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ messages: [{ id: "wamid.group" }] })) as unknown as FetchLike;
    const provider = createWhatsAppProvider(config, fetcher);

    await provider.sendGroupTextMessage("group-123", "Your class has ended.");

    const [, init] = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      messaging_product: "whatsapp",
      recipient_type: "group",
      to: "group-123",
      type: "text",
      text: { body: "Your class has ended." },
    });
  });

  it("creates a group then fetches its invite link", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "group-456" }))
      .mockResolvedValueOnce(jsonResponse({ messaging_product: "whatsapp", invite_link: "https://chat.whatsapp.com/abc" })) as unknown as FetchLike;
    const provider = createWhatsAppProvider(config, fetcher);

    const group = await provider.createGroup("Alice — 2tor", "Lesson updates for Alice");

    expect(group).toEqual({ providerGroupId: "group-456", inviteLink: "https://chat.whatsapp.com/abc" });
    const calls = (fetcher as ReturnType<typeof vi.fn>).mock.calls as Array<[string, RequestInit]>;
    const [createCall, inviteLinkCall] = calls;
    expect(createCall?.[0]).toBe("https://graph.facebook.com/v25.0/1234567890/groups");
    expect(inviteLinkCall?.[0]).toBe("https://graph.facebook.com/v25.0/group-456/invite_link");
    expect(inviteLinkCall?.[1].method).toBe("GET");
  });

  it("removes a participant via DELETE", async () => {
    const fetcher = vi.fn(async () => jsonResponse({})) as unknown as FetchLike;
    const provider = createWhatsAppProvider(config, fetcher);

    await provider.removeParticipant("group-456", "+15550002222");

    const [url, init] = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v25.0/group-456/participants");
    expect(init.method).toBe("DELETE");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({ messaging_product: "whatsapp", participants: [{ user: "+15550002222" }] });
  });

  it("throws when the Cloud API responds with a non-ok status", async () => {
    const fetcher = vi.fn(async () => jsonResponse({}, false, 401)) as unknown as FetchLike;
    const provider = createWhatsAppProvider(config, fetcher);

    await expect(
      provider.sendTemplateMessage({ to: "+15550001111", template: "group_invite", languageCode: "en", variables: [] }),
    ).rejects.toThrow(/401/);
  });
});

describe("createWhatsAppProvider — disabled", () => {
  it("no-ops every method instead of throwing, without calling fetch", async () => {
    const fetcher = vi.fn() as unknown as FetchLike;
    const provider = createWhatsAppProvider({ kind: "disabled" }, fetcher);

    const templateDelivery = await provider.sendTemplateMessage({
      to: "+15550001111",
      template: "group_invite",
      languageCode: "en",
      variables: [],
    });
    const groupDelivery = await provider.sendGroupTextMessage("group-123", "hi");
    const group = await provider.createGroup("Alice — 2tor");
    await provider.removeParticipant("group-123", "+15550001111");

    expect(templateDelivery).toEqual({ providerMessageId: undefined });
    expect(groupDelivery).toEqual({ providerMessageId: undefined });
    expect(group.providerGroupId).toMatch(/^disabled-/);
    expect(group.inviteLink).toBe("");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("still validates required fields", async () => {
    const provider = createWhatsAppProvider({ kind: "disabled" });
    await expect(
      provider.sendTemplateMessage({ to: "", template: "", languageCode: "", variables: [] }),
    ).rejects.toThrow();
    await expect(provider.createGroup("")).rejects.toThrow();
  });
});
