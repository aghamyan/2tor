"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Award,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDashed,
  Clock3,
  Filter,
  Flame,
  Gauge,
  HelpCircle,
  History,
  Info,
  LayoutList,
  ListChecks,
  LockKeyhole,
  Minus,
  PencilLine,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";

import { domainStats, statusLabels, type CurriculumDomain, type MasteryStatus, type TopicProgress } from "./progress-data";
import styles from "./progress-page.module.css";

type View = "map" | "table" | "timeline";
export type ActorRole = "parent" | "student" | "tutor" | "admin";

export interface TimelineEventData {
  date: string;
  type: string;
  title: string;
  detail: string;
  topicId: string;
}

export interface RewardsBadgeData {
  id: string;
  name: string;
  description: string | null;
}

export interface RewardsStreakData {
  type: string;
  currentCount: number;
  longestCount: number;
}

export interface RewardsSummaryData {
  totalPoints: number;
  levelName: string | null;
  badges: RewardsBadgeData[];
  streaks: RewardsStreakData[];
}

export interface LearnerOptionData {
  studentProfileId: string;
  name: string;
}

export interface SubjectOptionData {
  id: string;
  name: string;
}

export interface RawSkillEvent {
  id: string;
  createdAt: string;
  evidenceType: string;
  score: string | null;
  note: string | null;
  calculationMethod: "tutor" | "automatic";
}

const KEBAB_TO_API_STATUS: Record<MasteryStatus, string> = {
  mastered: "mastered",
  secure: "secure",
  developing: "developing",
  "needs-attention": "needs_attention",
  "not-demonstrated": "not_demonstrated",
  "not-assessed": "not_assessed",
  "in-progress": "in_progress",
  upcoming: "upcoming",
};

const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  tutor_observation: "Tutor observation",
  homework: "Homework",
  lesson_activity: "Lesson activity",
  diagnostic: "Diagnostic",
  assessment: "Assessment",
};

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const statusIcon: Record<MasteryStatus, typeof Check> = {
  mastered: CheckCircle2,
  secure: Check,
  developing: TrendingUp,
  "needs-attention": AlertCircle,
  "not-demonstrated": X,
  "not-assessed": CircleDashed,
  "in-progress": Clock3,
  upcoming: CalendarDays,
};

function StatusBadge({ status }: { status: MasteryStatus }) {
  const Icon = statusIcon[status];
  const t = useTranslations("academics.progress.status");
  return (
    <span className={styles.statusBadge} data-status={status}>
      <Icon size={13} aria-hidden="true" /> {t(status.replace(/-/g, "_"))}
    </span>
  );
}

function Trend({ topic, expanded = false }: { topic: TopicProgress; expanded?: boolean }) {
  const Icon = topic.trend === "up" ? ArrowUp : topic.trend === "down" ? ArrowDown : topic.trend === "steady" ? Minus : Sparkles;
  const text = topic.trend === "new" ? "New evidence" : topic.trend === "steady" ? "No recent change" : `${topic.trend === "up" ? "Up" : "Down"} since last time`;
  return (
    <span className={styles.trend} data-trend={topic.trend} title={expanded ? text : text}>
      <Icon size={14} aria-hidden="true" /> {expanded ? text : null}
    </span>
  );
}

function Score({ topic, large = false }: { topic: TopicProgress; large?: boolean }) {
  return (
    <div className={styles.score} data-large={large || undefined}>
      {topic.score === null ? <strong>—</strong> : <strong>{topic.score.toFixed(1)}</strong>}
      <span>{topic.score === null ? "No score" : "/ 10"}</span>
    </div>
  );
}

function StatusGlyph({ status }: { status: MasteryStatus }) {
  const Icon = statusIcon[status];
  return <Icon size={16} aria-hidden="true" />;
}

function MasteryDistribution({ allTopics }: { allTopics: TopicProgress[] }) {
  const counts = useMemo(() => {
    const result = new Map<MasteryStatus, number>();
    for (const topic of allTopics) result.set(topic.status, (result.get(topic.status) ?? 0) + 1);
    return result;
  }, [allTopics]);
  const t = useTranslations("academics.progress.status");
  return (
    <div className={styles.distribution} role="img" aria-label="Mastery distribution across all curriculum topics">
      <div className={styles.distributionBar}>
        {["mastered", "secure", "developing", "needs-attention", "not-demonstrated", "in-progress", "not-assessed", "upcoming"].map((status) => (
          <span key={status} data-status={status} style={{ "--segment": counts.get(status as MasteryStatus) ?? 0 } as CSSProperties} />
        ))}
      </div>
      <div className={styles.distributionLegend}>
        {(["mastered", "secure", "developing", "needs-attention", "not-assessed"] as MasteryStatus[]).map((status) => (
          <span key={status}><i data-status={status} /> {t(status.replace(/-/g, "_"))} <b>{counts.get(status) ?? 0}</b></span>
        ))}
      </div>
    </div>
  );
}

function Summary({ allTopics }: { allTopics: TopicProgress[] }) {
  const assessed = allTopics.filter((topic) => topic.score !== null);
  const assessedMastery = assessed.length
    ? Math.round((assessed.reduce((sum, topic) => sum + (topic.score ?? 0), 0) / assessed.length) * 10)
    : 0;
  const coverage = allTopics.length ? Math.round((assessed.length / allTopics.length) * 100) : 0;
  const mastered = allTopics.filter((topic) => topic.status === "mastered").length;
  const concerns = allTopics.filter((topic) => ["needs-attention", "not-demonstrated"].includes(topic.status)).length;
  const notAssessed = allTopics.filter((topic) => topic.status === "not-assessed").length;
  const inProgress = allTopics.filter((topic) => topic.status === "in-progress").length;
  const currentFocus = [...allTopics]
    .filter((topic) => ["needs-attention", "in-progress", "developing"].includes(topic.status))
    .sort((a, b) => (a.score ?? 10) - (b.score ?? 10))[0];
  return (
    <section aria-labelledby="overview-title" className={styles.summarySection}>
      <div className={styles.sectionHeading}>
        <div><p>At a glance</p><h2 id="overview-title">Curriculum overview</h2></div>
      </div>
      <div className={styles.summaryGrid}>
        <article className={`${styles.summaryCard} ${styles.masteryCard}`}>
          <div className={styles.summaryLabel}>Assessed mastery <span className={styles.tooltip}><Info size={14} /><span>Weighted from tutor-confirmed scores only. Unassessed topics are excluded.</span></span></div>
          <div className={styles.summaryValue}><strong>{assessedMastery}%</strong><span>across {assessed.length} assessed topics</span></div>
          <div className={styles.coverageTrack}><span style={{ width: `${assessedMastery}%` }} /></div>
          <div className={styles.coverageSplit}><span>Curriculum coverage</span><strong>{coverage}%</strong></div>
        </article>
        <article className={styles.summaryCard}><span className={styles.summaryIcon} data-tone="green"><CheckCircle2 size={17} /></span><div><span className={styles.summaryLabel}>Mastered topics</span><strong className={styles.compactValue}>{mastered} <small>of {allTopics.length}</small></strong><p>Consistent evidence at 8.5+</p></div></article>
        <article className={styles.summaryCard}><span className={styles.summaryIcon} data-tone="red"><AlertCircle size={17} /></span><div><span className={styles.summaryLabel}>Need attention</span><strong className={styles.compactValue}>{concerns}</strong><p>Flagged by the tutor</p></div></article>
        <article className={styles.summaryCard}><span className={styles.summaryIcon} data-tone="gray"><CircleDashed size={17} /></span><div><span className={styles.summaryLabel}>Not yet assessed</span><strong className={styles.compactValue}>{notAssessed}</strong><p>Missing evidence, never treated as zero</p></div></article>
        <article className={styles.summaryCard}><span className={styles.summaryIcon} data-tone="blue"><Target size={17} /></span><div><span className={styles.summaryLabel}>Current focus</span><strong className={styles.focusValue}>{currentFocus ? currentFocus.name : "None flagged"}</strong><p>{currentFocus ? `Score ${currentFocus.score?.toFixed(1) ?? "—"}` : "No topics need attention right now"}</p></div></article>
        <article className={styles.summaryCard}><span className={styles.summaryIcon} data-tone="amber"><Gauge size={17} /></span><div><span className={styles.summaryLabel}>In progress</span><strong className={styles.focusValue}>{inProgress}</strong><p>Topics with early evidence</p></div></article>
      </div>
      <MasteryDistribution allTopics={allTopics} />
    </section>
  );
}

function TopicRow({ topic, onOpen }: { topic: TopicProgress; onOpen: (topic: TopicProgress) => void }) {
  return (
    <article className={styles.topicRow} data-concern={topic.overdue || undefined}>
      <button className={styles.topicMain} type="button" onClick={() => onOpen(topic)} aria-label={`View details for ${topic.name}`}>
        <span className={styles.topicGlyph} data-status={topic.status}><StatusGlyph status={topic.status} /></span>
        <span><strong>{topic.name}</strong><small>{topic.code} · {topic.description}</small></span>
      </button>
      <Score topic={topic} />
      <StatusBadge status={topic.status} />
      <Trend topic={topic} expanded />
      <div className={styles.evidenceCell}><strong>{topic.lastAssessed ?? "Not assessed"}</strong><span>{topic.evidenceSummary}</span></div>
      <button className={styles.detailsButton} type="button" onClick={() => onOpen(topic)}>View details <ChevronRight size={15} /></button>
      <div className={styles.topicNote}><span>Tutor note</span><p>{topic.note}</p></div>
    </article>
  );
}

function DomainAccordion({ domain, open, onToggle, onOpenTopic }: { domain: CurriculumDomain; open: boolean; onToggle: () => void; onOpenTopic: (topic: TopicProgress) => void }) {
  const stats = domainStats(domain);
  return (
    <section className={styles.domain}>
      <button className={styles.domainHeader} type="button" onClick={onToggle} aria-expanded={open} aria-controls={`domain-${domain.id}`}>
        <span className={styles.domainMarker} />
        <span className={styles.domainTitle}><strong>{domain.name}</strong><small>{domain.description}</small></span>
        <span className={styles.domainStat}><b>{stats.score}%</b><small>mastery</small></span>
        <span className={styles.domainCounts}><b>{stats.mastered}</b> mastered <i /> <b>{stats.concerns}</b> concerns <i /> <b>{stats.unassessed}</b> unassessed</span>
        <span className={styles.domainProgress}><i><b style={{ width: `${stats.score}%` }} /></i></span>
        <ChevronDown className={styles.chevron} size={19} />
      </button>
      {open ? <div id={`domain-${domain.id}`} className={styles.topicList}>{domain.topics.map((topic) => <TopicRow key={topic.id} topic={topic} onOpen={onOpenTopic} />)}</div> : null}
    </section>
  );
}

function CurriculumMap({ domains, allTopics, onOpenTopic }: { domains: CurriculumDomain[]; allTopics: TopicProgress[]; onOpenTopic: (topic: TopicProgress) => void }) {
  const [openIds, setOpenIds] = useState(() => new Set(domains.slice(0, 1).map((domain) => domain.id)));
  return (
    <div className={styles.mapView}>
      <div className={styles.mapHead}><div><h2>Curriculum mastery map</h2><p>Open a unit to see scores, evidence, and tutor judgments in curriculum order.</p></div><span><BookOpenCheck size={16} /> {allTopics.length} topics</span></div>
      {domains.length ? (
        <div className={styles.domainList}>{domains.map((domain) => <DomainAccordion key={domain.id} domain={domain} open={openIds.has(domain.id)} onToggle={() => setOpenIds((current) => { const next = new Set(current); if (next.has(domain.id)) next.delete(domain.id); else next.add(domain.id); return next; })} onOpenTopic={onOpenTopic} />)}</div>
      ) : (
        <div className={styles.noResults}><Filter size={24} /><h3>No curriculum loaded for this subject yet</h3><p>Ask your tutor to add topics from a class review.</p></div>
      )}
    </div>
  );
}

function SkillsTable({ domains, allTopics, onOpenTopic }: { domains: CurriculumDomain[]; allTopics: TopicProgress[]; onOpenTopic: (topic: TopicProgress) => void }) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("all");
  const [status, setStatus] = useState("all");
  const [concerns, setConcerns] = useState(false);
  const [unassessed, setUnassessed] = useState(false);
  const [sort, setSort] = useState("curriculum");
  const withDomain = useMemo(
    () => allTopics.map((topic) => ({ ...topic, domainId: domains.find((d) => d.topics.some((t) => t.id === topic.id))?.id ?? "", domainName: domains.find((d) => d.topics.some((t) => t.id === topic.id))?.name ?? "" })),
    [allTopics, domains],
  );
  const rows = useMemo(() => {
    let items = withDomain.filter((topic) => topic.name.toLowerCase().includes(query.toLowerCase()) && (domain === "all" || topic.domainId === domain) && (status === "all" || topic.status === status) && (!concerns || ["needs-attention", "not-demonstrated"].includes(topic.status)) && (!unassessed || topic.status === "not-assessed"));
    if (sort === "score-low") items = [...items].sort((a, b) => (a.score ?? 99) - (b.score ?? 99));
    if (sort === "recent") items = [...items].sort((a, b) => (b.lastAssessed ?? "").localeCompare(a.lastAssessed ?? ""));
    return items;
  }, [withDomain, query, domain, status, concerns, unassessed, sort]);
  return (
    <section className={styles.tableView}>
      <div className={styles.filterBar}>
        <label className={styles.searchField}><Search size={16} /><span className={styles.srOnly}>Search topics</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search topics" type="search" /></label>
        <label><span className={styles.srOnly}>Filter by domain</span><select value={domain} onChange={(event) => setDomain(event.target.value)}><option value="all">All units</option>{domains.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span className={styles.srOnly}>Filter by status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span className={styles.srOnly}>Sort topics</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="curriculum">Curriculum order</option><option value="score-low">Lowest score first</option><option value="recent">Recently assessed</option></select></label>
        <button type="button" data-active={concerns} onClick={() => { setConcerns((value) => !value); setUnassessed(false); }}><AlertCircle size={14} /> Concerns</button>
        <button type="button" data-active={unassessed} onClick={() => { setUnassessed((value) => !value); setConcerns(false); }}><CircleDashed size={14} /> Not assessed</button>
      </div>
      <div className={styles.resultCount}>{rows.length} curriculum topics</div>
      <div className={styles.skillsTable} role="table" aria-label="Curriculum skills">
        <div className={styles.tableHeader} role="row"><span>Topic</span><span>Unit</span><span>Score</span><span>Status</span><span>Trend</span><span>Evidence</span><span /></div>
        {rows.map((topic) => <button type="button" className={styles.tableRow} role="row" key={topic.id} onClick={() => onOpenTopic(topic)}><span role="cell"><b>{topic.name}</b><small>{topic.code}</small></span><span role="cell">{topic.domainName}</span><span role="cell"><Score topic={topic} /></span><span role="cell"><StatusBadge status={topic.status} /></span><span role="cell"><Trend topic={topic} /></span><span role="cell"><b>{topic.evidenceCount || "—"}</b><small>{topic.lastAssessed ?? "No date"}</small></span><span role="cell"><ChevronRight size={16} /></span></button>)}
      </div>
      {rows.length === 0 ? <div className={styles.noResults}><Filter size={24} /><h3>No topics match these filters</h3><p>Clear a quick filter or try a broader search.</p></div> : null}
    </section>
  );
}

function TimelineView({ events, allTopics, onOpenTopic }: { events: TimelineEventData[]; allTopics: TopicProgress[]; onOpenTopic: (topic: TopicProgress) => void }) {
  return (
    <section className={styles.timelineView}>
      <div className={styles.timelineIntro}><div><h2>How mastery changed</h2><p>Only recorded lessons, assessments, and tutor-confirmed changes appear here.</p></div><span><History size={16} /> Recent activity</span></div>
      {events.length ? (
        <div className={styles.timelineList}>{events.map((event, index) => { const topic = allTopics.find((item) => item.id === event.topicId); return <button type="button" key={`${event.date}-${event.title}-${index}`} onClick={() => topic && onOpenTopic(topic)}><span className={styles.timelineDate}>{event.date}</span><span className={styles.timelineRail}><i />{index < events.length - 1 ? <b /> : null}</span><span className={styles.timelineContent}><small>{event.type}</small><strong>{event.title}</strong><p>{event.detail}</p><em>View evidence <ArrowRight size={13} /></em></span></button>; })}</div>
      ) : (
        <div className={styles.noResults}><History size={24} /><h3>No activity recorded yet</h3><p>Recorded class reviews will appear here as a timeline.</p></div>
      )}
    </section>
  );
}

function readinessFor(topic: TopicProgress, allTopics: TopicProgress[]) {
  const blocker = topic.prerequisiteIds?.find((id) => (allTopics.find((item) => item.id === id)?.score ?? 0) < 7);
  return blocker ? allTopics.find((item) => item.id === blocker) ?? null : null;
}

function LearningPlan({ allTopics, onOpenTopic }: { allTopics: TopicProgress[]; onOpenTopic: (topic: TopicProgress) => void }) {
  const currentFocus = [...allTopics].filter((topic) => ["needs-attention", "in-progress", "developing"].includes(topic.status)).sort((a, b) => (a.score ?? 10) - (b.score ?? 10)).slice(0, 3);
  const notReady = [...allTopics].filter((topic) => ["not-assessed", "upcoming"].includes(topic.status));
  const blocked = notReady.filter((topic) => readinessFor(topic, allTopics));
  const nextUp = notReady.filter((topic) => !readinessFor(topic, allTopics)).slice(0, 3);
  const recentlyCompleted = [...allTopics].filter((topic) => ["mastered", "secure"].includes(topic.status)).sort((a, b) => (b.lastAssessed ?? "").localeCompare(a.lastAssessed ?? "")).slice(0, 2);
  const groups = [
    { label: "Current focus", tone: "blue", topics: currentFocus },
    { label: "Next topics", tone: "purple", topics: nextUp },
    { label: "Blocked", tone: "red", topics: blocked },
    { label: "Recently completed", tone: "green", topics: recentlyCompleted },
  ];
  if (!groups.some((group) => group.topics.length)) return null;
  return (
    <section className={styles.learningPlan} aria-labelledby="learning-plan-title">
      <div className={styles.sectionHeading}><div><p>Sequence & readiness</p><h2 id="learning-plan-title">Learning plan</h2></div></div>
      <div className={styles.planGrid}>{groups.map((group) => <div className={styles.planColumn} key={group.label}><h3><i data-tone={group.tone} />{group.label}<span>{group.topics.length}</span></h3>{group.topics.map((topic) => { const blocker = readinessFor(topic, allTopics); return <button type="button" key={topic.id} onClick={() => onOpenTopic(topic)}><strong>{topic.name}</strong><small>{topic.lastAssessed ? `Last recorded ${topic.lastAssessed}` : topic.expectedTiming}</small>{blocker ? <span className={styles.readiness} data-ready="false"><LockKeyhole size={12} /> Not ready · blocked by {blocker.name}</span> : group.label === "Current focus" ? <span className={styles.readiness} data-ready="true"><Circle size={8} fill="currentColor" /> Teaching now</span> : group.label === "Next topics" ? <span className={styles.readiness}><Clock3 size={12} /> Ready for assessment</span> : <span className={styles.readiness} data-ready="true"><Check size={12} /> Tutor confirmed</span>}<ChevronRight size={15} /></button>; })}</div>)}</div>
    </section>
  );
}

function StrengthsPriorities({ allTopics, onOpenTopic }: { allTopics: TopicProgress[]; onOpenTopic: (topic: TopicProgress) => void }) {
  const strengths = [...allTopics].filter((topic) => topic.status === "mastered").sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3);
  const priorities = [...allTopics].filter((topic) => ["needs-attention", "not-demonstrated"].includes(topic.status)).sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 3);
  const panels = [
    { title: "Strengths", description: "Reliable skills backed by consistent evidence.", topics: strengths, tone: "strength" },
    { title: "Priority areas", description: "The most useful topics to reinforce next.", topics: priorities, tone: "priority" },
  ];
  if (!strengths.length && !priorities.length) return null;
  return <section className={styles.priorityGrid}>{panels.map((panel) => <article key={panel.title} data-tone={panel.tone}><div><span>{panel.tone === "strength" ? <TrendingUp size={18} /> : <Target size={18} />}</span><div><h2>{panel.title}</h2><p>{panel.description}</p></div></div><div>{panel.topics.length ? panel.topics.map((topic) => <button type="button" key={topic.id} onClick={() => onOpenTopic(topic)}><span><strong>{topic.name}</strong><small>{topic.evidenceSummary}</small></span><Score topic={topic} /><ChevronRight size={15} /></button>) : <p className={styles.mutedText}>Nothing recorded yet.</p>}</div></article>)}</section>;
}

function Sparkline({ history }: { history: NonNullable<TopicProgress["history"]> }) {
  const points = history.map((item, index) => `${12 + index * (156 / Math.max(1, history.length - 1))},${88 - item.score * 7.2}`).join(" ");
  return <div className={styles.sparkline} role="img" aria-label={`Score history: ${history.map((item) => `${item.date} ${item.score}`).join(", ")}`}><span>10</span><svg viewBox="0 0 180 96" preserveAspectRatio="none"><line x1="8" y1="16" x2="174" y2="16" /><line x1="8" y1="52" x2="174" y2="52" /><line x1="8" y1="88" x2="174" y2="88" /><polyline points={points} />{history.map((item, index) => <circle key={item.date} cx={12 + index * (156 / Math.max(1, history.length - 1))} cy={88 - item.score * 7.2} r="3.5" />)}</svg><span>0</span><div>{history.map((item) => <small key={item.date}>{item.date}</small>)}</div></div>;
}

function TopicDrawer({ topic, studentProfileId, allTopics, onClose }: { topic: TopicProgress; studentProfileId: string; allTopics: TopicProgress[]; onClose: () => void }) {
  const [tab, setTab] = useState("evidence");
  const [events, setEvents] = useState<RawSkillEvent[] | null>(null);
  useEffect(() => { const handler = (event: KeyboardEvent) => event.key === "Escape" && onClose(); document.addEventListener("keydown", handler); return () => document.removeEventListener("keydown", handler); }, [onClose]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/academics/skills/${topic.id}/events?studentProfileId=${encodeURIComponent(studentProfileId)}`)
      .then((response) => (response.ok ? response.json() : { data: { events: [] } }))
      .then((payload) => { if (!cancelled) setEvents(payload.data?.events ?? []); })
      .catch(() => { if (!cancelled) setEvents([]); });
    return () => { cancelled = true; };
  }, [topic.id, studentProfileId]);
  const prerequisites = topic.prerequisiteIds?.map((id) => allTopics.find((item) => item.id === id)).filter(Boolean) as TopicProgress[] | undefined;
  const evidence = (events ?? []).map((event) => ({ id: event.id, date: formatEventDate(event.createdAt), type: EVIDENCE_TYPE_LABEL[event.evidenceType] ?? "Tutor observation", result: event.score !== null ? `${Number(event.score).toFixed(1)} / 10` : "Observed", note: event.note ?? "", calculation: event.calculationMethod }));
  const history = (events ?? []).filter((event) => event.score !== null).slice().reverse().map((event) => ({ date: formatEventDate(event.createdAt), score: Number(event.score) }));
  return <div className={styles.drawerLayer} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="drawer-title"><header><div><span>{topic.code}</span><h2 id="drawer-title">{topic.name}</h2><p>{topic.description}</p></div><button type="button" onClick={onClose} aria-label="Close topic details"><X size={19} /></button></header><div className={styles.drawerScore}><Score topic={topic} large /><div><StatusBadge status={topic.status} />{topic.confidence ? <p>{`${topic.confidence.charAt(0).toUpperCase()}${topic.confidence.slice(1)} confidence · ${topic.evidenceCount} evidence ${topic.evidenceCount === 1 ? "item" : "items"}`}</p> : <p>No reliable evidence yet</p>}</div><Trend topic={topic} expanded /></div><nav className={styles.drawerTabs} aria-label="Topic detail sections">{(["evidence", "learning", "history"] as const).map((id) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>{id === "evidence" ? "Evidence" : id === "learning" ? "Learning plan" : "History"}</button>)}</nav><div className={styles.drawerBody}>{tab === "evidence" ? <><section><h3>Why this score exists</h3><p className={styles.parentSummary}>{topic.parentSummary}</p>{events === null ? <p className={styles.mutedText}>Loading evidence…</p> : evidence.length ? <div className={styles.evidenceTimeline}>{evidence.map((item) => <article key={item.id}><span data-kind={item.calculation}>{item.calculation === "automatic" ? <BarChart3 size={15} /> : <UserRound size={15} />}</span><div><div><strong>{item.date} · {item.type}</strong><b>{item.result}</b></div><p>{item.note}</p><small>{item.calculation === "automatic" ? "Automatically calculated evidence" : "Tutor-entered judgment"}</small></div></article>)}</div> : <div className={styles.drawerEmpty}><CircleDashed size={21} /><strong>No evidence recorded</strong><p>Missing evidence is not converted into a zero score.</p></div>}</section>{topic.mistakePatterns?.length ? <section><h3>Known misconceptions for this unit</h3><ul>{topic.mistakePatterns.map((pattern) => <li key={pattern}>{pattern}</li>)}</ul></section> : null}</> : null}{tab === "learning" ? <><section><h3>Recommended next step</h3><p className={styles.parentSummary}>{topic.recommendedAction}</p></section><section><h3>Prerequisite skills</h3>{prerequisites?.length ? prerequisites.map((item) => <button className={styles.prerequisite} type="button" key={item.id}><span><strong>{item.name}</strong><StatusBadge status={item.status} /></span><Score topic={item} /></button>) : <p className={styles.mutedText}>No curriculum prerequisites are blocking this topic.</p>}</section></> : null}{tab === "history" ? <><section><h3>Score history</h3>{history.length ? <Sparkline history={history} /> : <div className={styles.drawerEmpty}><History size={21} /><strong>Not enough history yet</strong><p>A trend appears after multiple confirmed observations.</p></div>}</section></> : null}</div></aside></div>;
}

function TutorClassReview({ allTopics, studentProfileId, onClose, onSaved }: { allTopics: TopicProgress[]; studentProfileId: string; onClose: () => void; onSaved: () => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, { score: string; status: MasteryStatus }>>({});
  const [sharedNote, setSharedNote] = useState("");
  const [evidenceType, setEvidenceType] = useState("tutor_observation");
  const [visibleToParent, setVisibleToParent] = useState(true);
  const [visibleToStudent, setVisibleToStudent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtered = allTopics.filter((topic) => topic.name.toLowerCase().includes(query.toLowerCase())).slice(0, 40);

  function toggle(topic: TopicProgress) {
    setSelected((current) => {
      const next = { ...current };
      if (next[topic.id]) delete next[topic.id];
      else next[topic.id] = { score: topic.score !== null ? topic.score.toFixed(1) : "", status: topic.status === "not-assessed" ? "developing" : topic.status };
      return next;
    });
  }

  function setEntry(topicId: string, patch: Partial<{ score: string; status: MasteryStatus }>) {
    setSelected((current) => {
      const existing = current[topicId] ?? { score: "", status: "developing" as MasteryStatus };
      return { ...current, [topicId]: { ...existing, ...patch } };
    });
  }

  async function submit() {
    const entries = Object.entries(selected).map(([skillId, value]) => ({
      skillId,
      score: value.score.trim() === "" ? null : Number(value.score),
      status: KEBAB_TO_API_STATUS[value.status],
      note: null,
    }));
    if (entries.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/academics/skills/assessments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentProfileId, sharedNote: sharedNote.trim() || null, evidenceType, visibleToParent, visibleToStudent, entries }),
      });
      if (!response.ok) throw new Error("save failed");
      setSaved(true);
      onSaved();
    } catch {
      setError("Could not save this review. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedTopics = allTopics.filter((topic) => selected[topic.id]);

  return <div className={styles.drawerLayer} role="presentation"><section className={`${styles.drawer} ${styles.reviewDrawer}`} role="dialog" aria-modal="true" aria-labelledby="review-title"><header><div><span>Fast update</span><h2 id="review-title">Class review</h2><p>Record evidence for several covered topics, then publish together.</p></div><button type="button" onClick={onClose} aria-label="Close class review"><X size={19} /></button></header><div className={styles.reviewBody}><section><div className={styles.reviewHeading}><div><span>1</span><div><h3>Select topics covered</h3><p>Search and choose only skills you observed today.</p></div></div><small>{Object.keys(selected).length} selected</small></div><label className={styles.searchField}><Search size={16} /><span className={styles.srOnly}>Search topics</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search topics" type="search" /></label><div className={styles.topicChecks}>{filtered.map((topic) => <button type="button" key={topic.id} data-selected={Boolean(selected[topic.id])} onClick={() => toggle(topic)}><span>{selected[topic.id] ? <Check size={14} /> : null}</span><div><strong>{topic.name}</strong><small>{topic.code} · current {topic.score?.toFixed(1) ?? "not assessed"}</small></div></button>)}</div></section>{selectedTopics.length ? <section><div className={styles.reviewHeading}><div><span>2</span><div><h3>Set scores and status</h3><p>Score and status are both required — status is never guessed from the score.</p></div></div></div><div className={styles.scoreEditors}>{selectedTopics.map((topic) => <div key={topic.id}><div><strong>{topic.name}</strong><small>Current {topic.score?.toFixed(1) ?? "—"}</small></div><input aria-label={`New score for ${topic.name}`} type="number" min="0" max="10" step="0.1" value={selected[topic.id]?.score ?? ""} onChange={(event) => setEntry(topic.id, { score: event.target.value })} placeholder="—" /><select aria-label={`New status for ${topic.name}`} value={selected[topic.id]?.status ?? "developing"} onChange={(event) => setEntry(topic.id, { status: event.target.value as MasteryStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>)}</div></section> : null}<section><div className={styles.reviewHeading}><div><span>3</span><div><h3>Link today&apos;s evidence</h3><p>One shared note applies to every selected topic.</p></div></div></div><label className={styles.noteField}>Shared lesson note<textarea rows={3} value={sharedNote} onChange={(event) => setSharedNote(event.target.value)} placeholder="What did you observe?" /></label><div className={styles.evidenceOptions}><label><input type="radio" name="evidenceType" checked={evidenceType === "tutor_observation"} onChange={() => setEvidenceType("tutor_observation")} /> Lesson observation</label><label><input type="radio" name="evidenceType" checked={evidenceType === "homework"} onChange={() => setEvidenceType("homework")} /> Homework evidence</label><label><input type="radio" name="evidenceType" checked={evidenceType === "assessment"} onChange={() => setEvidenceType("assessment")} /> Formal assessment</label></div><div className={styles.evidenceOptions}><label><input type="checkbox" checked={visibleToParent} onChange={(event) => setVisibleToParent(event.target.checked)} /> Visible to parent</label><label><input type="checkbox" checked={visibleToStudent} onChange={(event) => setVisibleToStudent(event.target.checked)} /> Visible to student</label></div></section></div><footer><p><History size={14} /> Every published change is added to the evidence history.</p><button type="button" className={styles.publishButton} disabled={submitting || selectedTopics.length === 0} onClick={submit}>{submitting ? "Saving…" : "Publish review"}</button></footer>{saved ? <div className={styles.toast} role="status"><CheckCircle2 size={17} /> Class review saved.</div> : null}{error ? <div className={styles.toast} role="alert" data-tone="error">{error}</div> : null}</section></div>;
}

function RewardsSection({ summary }: { summary: RewardsSummaryData | null }) {
  const t = useTranslations("academics.progress.rewards");
  if (!summary) return null;
  return (
    <section aria-labelledby="rewards-title" className={styles.summarySection}>
      <div className={styles.sectionHeading}><div><p>{t("kicker")}</p><h2 id="rewards-title">{t("title")}</h2></div></div>
      <div className={styles.summaryGrid}>
        <article className={styles.summaryCard}><span className={styles.summaryIcon} data-tone="blue"><Sparkles size={17} /></span><div><span className={styles.summaryLabel}>{t("points")}</span><strong className={styles.compactValue}>{summary.totalPoints}</strong><p>{summary.levelName ?? t("levelUnset")}</p></div></article>
        <article className={styles.summaryCard}><span className={styles.summaryIcon} data-tone="amber"><Award size={17} /></span><div><span className={styles.summaryLabel}>{t("badges")}</span><strong className={styles.compactValue}>{summary.badges.length}</strong><p>{summary.badges.length ? summary.badges.map((badge) => badge.name).join(", ") : t("noBadges")}</p></div></article>
        {summary.streaks.map((streak) => (
          <article className={styles.summaryCard} key={streak.type}><span className={styles.summaryIcon} data-tone="green"><Flame size={17} /></span><div><span className={styles.summaryLabel}>{streak.type === "attendance" ? t("attendanceStreak") : t("assignmentStreak")}</span><strong className={styles.compactValue}>{streak.currentCount}</strong><p>{t("bestStreak", { count: streak.longestCount })}</p></div></article>
        ))}
      </div>
    </section>
  );
}

export interface ProgressPageProps {
  role: ActorRole;
  studentProfileId: string;
  subjectId: string;
  learnerName: string;
  subjectName: string;
  updatedLabel: string | null;
  domains: CurriculumDomain[];
  timelineEvents: TimelineEventData[];
  rewards: RewardsSummaryData | null;
  learnerOptions: LearnerOptionData[];
  subjectOptions: SubjectOptionData[];
}

export function ProgressPage({
  role,
  studentProfileId,
  subjectId,
  learnerName,
  subjectName,
  updatedLabel,
  domains,
  timelineEvents,
  rewards,
  learnerOptions,
  subjectOptions,
}: ProgressPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("academics.progress");
  const [view, setView] = useState<View>("map");
  const [selectedTopic, setSelectedTopic] = useState<TopicProgress | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const allTopics = useMemo(() => domains.flatMap((domain) => domain.topics), [domains]);

  function navigate(next: { student?: string; subject?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.student) params.set("student", next.student);
    if (next.subject) params.set("subject", next.subject);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headerCopy}>
          <div className={styles.headerMeta}><span>{t(`roleLabel.${role}`)}</span>{updatedLabel ? <><i /> <span>{updatedLabel}</span></> : null}</div>
          <h1>{t("title", { name: learnerName })}</h1>
          <p>{subjectName}</p>
        </div>
        {role === "tutor" ? <button type="button" className={styles.reviewButton} onClick={() => setReviewOpen(true)}><PencilLine size={16} /> {t("startReview")}</button> : null}
      </header>
      {learnerOptions.length > 1 || subjectOptions.length > 1 ? (
        <section className={styles.selectorBar} aria-label="Progress selections">
          {learnerOptions.length > 1 ? <label><span>{t("selector.learner")}</span><select value={studentProfileId} onChange={(event) => navigate({ student: event.target.value })}>{learnerOptions.map((option) => <option key={option.studentProfileId} value={option.studentProfileId}>{option.name}</option>)}</select></label> : null}
          {subjectOptions.length > 1 ? <label><span>{t("selector.subject")}</span><select value={subjectId} onChange={(event) => navigate({ subject: event.target.value })}>{subjectOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label> : null}
        </section>
      ) : null}
      <Summary allTopics={allTopics} />
      <RewardsSection summary={rewards} />
      <div className={styles.viewToolbar}>
        <div className={styles.viewSwitcher} role="tablist" aria-label="Progress views">
          {([["map", LayoutList, t("views.map")], ["table", ListChecks, t("views.table")], ["timeline", History, t("views.timeline")]] as const).map(([id, Icon, label]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}><Icon size={16} /> {label}</button>
          ))}
        </div>
        <div className={styles.viewNote}><Info size={14} /> {t("viewNote")}</div>
      </div>
      {view === "map" ? (
        <CurriculumMap domains={domains} allTopics={allTopics} onOpenTopic={setSelectedTopic} />
      ) : view === "table" ? (
        <SkillsTable domains={domains} allTopics={allTopics} onOpenTopic={setSelectedTopic} />
      ) : (
        <TimelineView events={timelineEvents} allTopics={allTopics} onOpenTopic={setSelectedTopic} />
      )}
      <LearningPlan allTopics={allTopics} onOpenTopic={setSelectedTopic} />
      <StrengthsPriorities allTopics={allTopics} onOpenTopic={setSelectedTopic} />
      <footer className={styles.pageFooter}><HelpCircle size={17} /><p><strong>How mastery works</strong> The tutor records a score and status for each topic after a lesson, homework, or assessment. &quot;Not assessed&quot; means evidence is missing; a score of 0 means a skill was assessed but not yet demonstrated.</p></footer>
      {selectedTopic ? <TopicDrawer key={selectedTopic.id} topic={selectedTopic} studentProfileId={studentProfileId} allTopics={allTopics} onClose={() => setSelectedTopic(null)} /> : null}
      {reviewOpen ? <TutorClassReview allTopics={allTopics} studentProfileId={studentProfileId} onClose={() => setReviewOpen(false)} onSaved={() => router.refresh()} /> : null}
    </div>
  );
}
