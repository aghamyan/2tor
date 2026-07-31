"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import styles from "./communication.module.css";

type MemberRole = "parent" | "student" | "tutor" | "staff";
type Member = { id: string; userId: string; role: MemberRole; leftAt: string | null };
type Attachment = {
  id: string;
  fileName: string;
  virusScanStatus: "pending" | "clean" | "infected" | "error";
};
type Message = {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  sentAt: string;
  isRedacted: boolean;
  attachments: Attachment[];
  reads: { userId: string }[];
  optimistic?: boolean;
  failed?: boolean;
};
type Conversation = {
  id: string;
  type: string;
  title: string | null;
  members: Member[];
  messages?: Message[];
};
type Detail = Conversation & { messages: Message[]; nextMessageCursor: string | null };
type ApiError = { error?: { code?: string; message?: string } };

async function responseData<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as { data?: T } & ApiError;
  if (!response.ok || payload.data === undefined) {
    const error = new Error(payload.error?.message ?? "Request failed.") as Error & {
      code?: string;
    };
    error.code = payload.error?.code;
    throw error;
  }
  return payload.data;
}

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort(
    (left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime(),
  );
}

export function CommunicationInbox() {
  const t = useTranslations("communication");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [staffReason, setStaffReason] = useState("");
  const [reasonRequired, setReasonRequired] = useState(false);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [connection, setConnection] = useState<"live" | "polling" | "connecting">("connecting");
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const accessVersionRef = useRef(0);

  const openConversation = useCallback(async (conversationId: string, reason: string) => {
    setError(null);
    const search = new URLSearchParams();
    if (reason.trim()) search.set("staffReason", reason.trim());
    try {
      const response = await fetch(
        `/api/communication/conversations/${conversationId}?${search.toString()}`,
      );
      const opened = await responseData<Detail>(response);
      setDetail(opened);
      setReasonRequired(false);
      setConnection("connecting");
      cursorRef.current = opened.messages.at(-1)?.id ?? null;
      accessVersionRef.current += 1;
      const latest = opened.messages.at(-1);
      if (latest) {
        void fetch(`/api/communication/conversations/${conversationId}/reads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: latest.id }),
        });
      }
    } catch (caught) {
      const typed = caught as Error & { code?: string };
      if (typed.code === "STAFF_REASON_REQUIRED") {
        setReasonRequired(true);
        setDetail(null);
      } else {
        setError(typed.message);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/communication/conversations")
      .then((response) => responseData<{ items: Conversation[] }>(response))
      .then(({ items }) => {
        if (!active) return;
        setConversations(items);
        const first = items[0];
        if (first) {
          setActiveId(first.id);
          void openConversation(first.id, "");
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : t("errors.load"));
      });
    return () => {
      active = false;
    };
  }, [openConversation, t]);

  const detailId = detail?.id;
  useEffect(() => {
    if (!activeId || !detailId || reasonRequired) return;
    const version = accessVersionRef.current;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    const query = new URLSearchParams();
    if (cursorRef.current) query.set("after", cursorRef.current);
    if (staffReason.trim()) query.set("staffReason", staffReason.trim());
    const source = new EventSource(
      `/api/communication/conversations/${activeId}/events?${query.toString()}`,
    );
    source.addEventListener("ready", () => {
      if (version === accessVersionRef.current) setConnection("live");
    });
    source.addEventListener("message", (event) => {
      if (version !== accessVersionRef.current) return;
      const message = JSON.parse((event as MessageEvent<string>).data) as Message;
      cursorRef.current = message.id;
      setDetail((current) =>
        current ? { ...current, messages: mergeMessages(current.messages, [message]) } : current,
      );
      void fetch(`/api/communication/conversations/${activeId}/reads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id }),
      });
    });
    source.onerror = () => {
      source.close();
      if (version !== accessVersionRef.current) return;
      setConnection("polling");
      const poll = async () => {
        const search = new URLSearchParams();
        if (cursorRef.current) search.set("cursor", cursorRef.current);
        if (staffReason.trim()) search.set("staffReason", staffReason.trim());
        try {
          const response = await fetch(
            `/api/communication/conversations/${activeId}?${search.toString()}`,
          );
          const update = await responseData<Detail>(response);
          if (version !== accessVersionRef.current) return;
          if (update.messages.length) cursorRef.current = update.messages.at(-1)?.id ?? null;
          setDetail((current) =>
            current
              ? { ...current, messages: mergeMessages(current.messages, update.messages) }
              : current,
          );
        } catch {
          // The visible polling state communicates temporary realtime degradation.
        }
      };
      void poll();
      pollTimer = setInterval(() => void poll(), 10_000);
    };
    return () => {
      source.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [activeId, detailId, reasonRequired, staffReason]);

  function selectConversation(conversationId: string) {
    setActiveId(conversationId);
    setDetail(null);
    setReasonRequired(false);
    setReportingId(null);
    void openConversation(conversationId, "");
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || !draft.trim() || sending) return;
    setSending(true);
    setError(null);
    const optimisticId = `optimistic-${crypto.randomUUID()}`;
    const optimistic: Message = {
      id: optimisticId,
      conversationId: activeId,
      senderUserId: "__optimistic_self__",
      body: draft.trim(),
      sentAt: new Date().toISOString(),
      isRedacted: false,
      attachments: files.map((file, index) => ({
        id: `${optimisticId}-${index}`,
        fileName: file.name,
        virusScanStatus: "pending",
      })),
      reads: [],
      optimistic: true,
    };
    const body = draft.trim();
    const selectedFiles = files;
    setDetail((current) =>
      current ? { ...current, messages: [...current.messages, optimistic] } : current,
    );
    setDraft("");
    setFiles([]);

    try {
      const response = await fetch(`/api/communication/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      let saved = await responseData<Message>(response);
      for (const file of selectedFiles) {
        const form = new FormData();
        form.set("file", file);
        const upload = await fetch(`/api/communication/messages/${saved.id}/attachments`, {
          method: "POST",
          body: form,
        });
        const attachment = await responseData<Attachment>(upload);
        saved = { ...saved, attachments: [...saved.attachments, attachment] };
      }
      cursorRef.current = saved.id;
      setDetail((current) =>
        current
          ? {
              ...current,
              messages: mergeMessages(
                current.messages.filter((message) => message.id !== optimisticId),
                [saved],
              ),
            }
          : current,
      );
    } catch (caught) {
      setDetail((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((message) =>
                message.id === optimisticId
                  ? { ...message, optimistic: false, failed: true }
                  : message,
              ),
            }
          : current,
      );
      setError(caught instanceof Error ? caught.message : t("errors.send"));
    } finally {
      setSending(false);
    }
  }

  async function submitReport(messageId: string) {
    if (reportReason.trim().length < 10) return;
    try {
      const response = await fetch("/api/communication/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, reason: reportReason }),
      });
      await responseData(response);
      setReportSent(messageId);
      setReportingId(null);
      setReportReason("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("errors.report"));
    }
  }

  async function download(attachment: Attachment) {
    const search = new URLSearchParams();
    if (staffReason.trim()) search.set("staffReason", staffReason.trim());
    try {
      const response = await fetch(
        `/api/communication/attachments/${attachment.id}?${search.toString()}`,
      );
      const data = await responseData<{ downloadUrl: string }>(response);
      window.location.assign(data.downloadUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("errors.download"));
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <div>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h1>{t("title")}</h1>
          <p>{t("intro")}</p>
        </div>
        <div className={styles.safetySeal}>
          <span aria-hidden="true">◉</span>
          <strong>{t("parentVisible")}</strong>
          <small>{t("audited")}</small>
        </div>
      </header>

      {error ? (
        <div className={styles.error} role="alert">
          {error}
          <button type="button" onClick={() => setError(null)}>
            {t("dismiss")}
          </button>
        </div>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.inbox} aria-label={t("conversationList")}>
          <div className={styles.inboxHeading}>
            <h2>{t("inbox")}</h2>
            <span>{conversations.length}</span>
          </div>
          {conversations.length === 0 ? (
            <p className={styles.empty}>{t("empty")}</p>
          ) : (
            <ul>
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    className={conversation.id === activeId ? styles.activeConversation : ""}
                    type="button"
                    onClick={() => selectConversation(conversation.id)}
                  >
                    <strong>{conversation.title ?? t("untitled")}</strong>
                    <span>
                      {conversation.members
                        .filter((member) => member.leftAt === null)
                        .map((member) => t(`roles.${member.role}`))
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className={styles.thread}>
          {!activeId ? (
            <div className={styles.blankState}>
              <h2>{t("selectTitle")}</h2>
              <p>{t("selectBody")}</p>
            </div>
          ) : reasonRequired ? (
            <form
              className={styles.reasonGate}
              onSubmit={(event) => {
                event.preventDefault();
                void openConversation(activeId, staffReason);
              }}
            >
              <p className={styles.eyebrow}>{t("staffAccess.eyebrow")}</p>
              <h2>{t("staffAccess.title")}</h2>
              <p>{t("staffAccess.body")}</p>
              <label htmlFor="staff-reason">{t("staffAccess.label")}</label>
              <textarea
                id="staff-reason"
                minLength={10}
                maxLength={500}
                required
                value={staffReason}
                onChange={(event) => setStaffReason(event.target.value)}
              />
              <button type="submit">{t("staffAccess.open")}</button>
            </form>
          ) : !detail ? (
            <p className={styles.loading} aria-live="polite">
              {t("loading")}
            </p>
          ) : (
            <>
              <header className={styles.threadHeader}>
                <div>
                  <p className={styles.eyebrow}>{t("sharedRoom")}</p>
                  <h2>{detail.title ?? t("untitled")}</h2>
                </div>
                <span className={styles.connection} data-state={connection}>
                  {t(`connection.${connection}`)}
                </span>
                <div className={styles.memberRail} aria-label={t("participants")}>
                  {detail.members
                    .filter((member) => member.leftAt === null)
                    .map((member) => (
                      <span key={member.id} data-role={member.role}>
                        {t(`roles.${member.role}`)}
                      </span>
                    ))}
                </div>
              </header>

              <ol className={styles.transcript} aria-live="polite">
                {detail.messages.length === 0 ? (
                  <li className={styles.emptyTranscript}>{t("noMessages")}</li>
                ) : (
                  detail.messages.map((message) => (
                    <li
                      className={`${styles.message} ${message.optimistic ? styles.optimistic : ""} ${message.failed ? styles.failed : ""}`}
                      key={message.id}
                    >
                      <div className={styles.messageMeta}>
                        <strong>
                          {message.senderUserId === "__optimistic_self__"
                            ? t("you")
                            : t(
                                `roles.${
                                  detail.members.find(
                                    (member) => member.userId === message.senderUserId,
                                  )?.role ?? "staff"
                                }`,
                              )}
                        </strong>
                        <time dateTime={message.sentAt}>
                          {new Intl.DateTimeFormat(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(message.sentAt))}
                        </time>
                      </div>
                      <div className={styles.messageBody}>
                        <p>{message.isRedacted ? t("redacted") : message.body}</p>
                        {message.attachments.length ? (
                          <ul className={styles.attachments}>
                            {message.attachments.map((attachment) => (
                              <li key={attachment.id}>
                                <button
                                  type="button"
                                  disabled={attachment.virusScanStatus !== "clean"}
                                  onClick={() => void download(attachment)}
                                >
                                  {attachment.fileName}
                                </button>
                                <span data-scan={attachment.virusScanStatus}>
                                  {t(`scan.${attachment.virusScanStatus}`)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <div className={styles.messageActions}>
                          <span>
                            {message.failed
                              ? t("sendFailed")
                              : message.optimistic
                                ? t("sending")
                                : t("seen", { count: message.reads.length })}
                          </span>
                          {!message.optimistic && !message.failed ? (
                            <button
                              type="button"
                              onClick={() =>
                                setReportingId((current) =>
                                  current === message.id ? null : message.id,
                                )
                              }
                            >
                              {reportSent === message.id ? t("report.sent") : t("report.action")}
                            </button>
                          ) : null}
                        </div>
                        {reportingId === message.id ? (
                          <div className={styles.reportPanel}>
                            <label htmlFor={`report-${message.id}`}>{t("report.label")}</label>
                            <textarea
                              id={`report-${message.id}`}
                              minLength={10}
                              maxLength={1_000}
                              value={reportReason}
                              onChange={(event) => setReportReason(event.target.value)}
                            />
                            <div>
                              <button
                                type="button"
                                disabled={reportReason.trim().length < 10}
                                onClick={() => void submitReport(message.id)}
                              >
                                {t("report.send")}
                              </button>
                              <button type="button" onClick={() => setReportingId(null)}>
                                {t("cancel")}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))
                )}
              </ol>

              <form className={styles.composer} onSubmit={send}>
                <label htmlFor="message-body">{t("composer.label")}</label>
                <textarea
                  id="message-body"
                  maxLength={10_000}
                  required
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={t("composer.placeholder")}
                />
                <div className={styles.composerActions}>
                  <label className={styles.filePicker}>
                    {t("composer.attach")}
                    <input
                      type="file"
                      multiple
                      onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                    />
                  </label>
                  <span>{files.map((file) => file.name).join(", ")}</span>
                  <button type="submit" disabled={sending || !draft.trim()}>
                    {sending ? t("sending") : t("composer.send")}
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
