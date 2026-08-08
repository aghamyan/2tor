"use client";

import { Camera, ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";
import { useState } from "react";
import type { AntiCheatingCopy } from "./anti-cheating-content";
import styles from "./anti-cheating-page.module.css";

export interface SessionConfig {
  childId: string;
  childName: string;
  assignmentId: string;
  assignmentName: string;
  optionKeys: string[];
  durationMinutes: number;
}

export interface HomeworkSessionSetupProps {
  copy: AntiCheatingCopy["setup"];
  onCancel: () => void;
  onComplete: (config: SessionConfig) => void;
}

const TOTAL_STEPS = 5;
const DEFAULT_OPTION_KEYS = ["tab-switch", "window-blur", "copy-paste"];

export function HomeworkSessionSetup({ copy, onCancel, onComplete }: HomeworkSessionSetupProps) {
  const [step, setStep] = useState(0);
  const [childId, setChildId] = useState(copy.children[0]?.id ?? "");
  const [assignmentId, setAssignmentId] = useState(copy.assignments[0]?.id ?? "");
  const [customAssignment, setCustomAssignment] = useState("");
  const [optionKeys, setOptionKeys] = useState<string[]>(DEFAULT_OPTION_KEYS);
  const [durationId, setDurationId] = useState(copy.durations[0]?.id ?? "30");
  const [customMinutes, setCustomMinutes] = useState(30);

  const child = copy.children.find((entry) => entry.id === childId) ?? copy.children[0];
  const assignment = copy.assignments.find((entry) => entry.id === assignmentId);
  const assignmentName =
    assignmentId === "custom" ? customAssignment || copy.customAssignmentPlaceholder : (assignment?.name ?? "");
  const durationMinutes = durationId === "custom" ? customMinutes : Number(durationId);

  function toggleOption(key: string) {
    setOptionKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function next() {
    setStep((current) => Math.min(current + 1, TOTAL_STEPS - 1));
  }
  function back() {
    setStep((current) => Math.max(current - 1, 0));
  }

  function start() {
    if (!child) return;
    onComplete({
      childId: child.id,
      childName: child.name,
      assignmentId,
      assignmentName,
      optionKeys,
      durationMinutes,
    });
  }

  const stepLegends = [copy.steps.child, copy.steps.assignment, copy.steps.options, copy.steps.duration, copy.steps.review];

  return (
    <div className={styles.setupCard}>
      <div className={styles.setupHead}>
        <h3>{copy.title}</h3>
        <button type="button" className={styles.setupCloseButton} onClick={onCancel}>
          {copy.handoff.cancel}
        </button>
      </div>

      <div className={styles.formProgressRow}>
        <p>{copy.progress.replace("{current}", String(step + 1)).replace("{total}", String(TOTAL_STEPS))}</p>
        <div className={styles.formProgress} aria-hidden="true">
          <span style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      <fieldset className={styles.formStep} hidden={step !== 0}>
        <legend>{stepLegends[0]?.legend}</legend>
        <p>{stepLegends[0]?.intro}</p>
        <div className={styles.choiceGrid}>
          {copy.children.map((entry) => (
            <label className={styles.choice} key={entry.id}>
              <input
                type="radio"
                name="child"
                value={entry.id}
                checked={childId === entry.id}
                onChange={() => setChildId(entry.id)}
              />
              <span>
                <strong>{entry.name}</strong>
                <small>{entry.detail}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.formStep} hidden={step !== 1}>
        <legend>{stepLegends[1]?.legend}</legend>
        <p>{stepLegends[1]?.intro}</p>
        <div className={styles.choiceGrid}>
          {copy.assignments.map((entry) => (
            <label className={styles.choice} key={entry.id}>
              <input
                type="radio"
                name="assignment"
                value={entry.id}
                checked={assignmentId === entry.id}
                onChange={() => setAssignmentId(entry.id)}
              />
              <span>{entry.name}</span>
            </label>
          ))}
        </div>
        {assignmentId === "custom" && (
          <label className={styles.textField}>
            <span>{copy.customAssignmentLabel}</span>
            <input
              value={customAssignment}
              onChange={(event) => setCustomAssignment(event.target.value)}
              placeholder={copy.customAssignmentPlaceholder}
              maxLength={120}
            />
          </label>
        )}
      </fieldset>

      <fieldset className={styles.formStep} hidden={step !== 2}>
        <legend>{stepLegends[2]?.legend}</legend>
        <p>{stepLegends[2]?.intro}</p>
        <div className={styles.optionList}>
          {copy.options.map((option) => (
            <label className={styles.optionRow} key={option.key}>
              <input
                type="checkbox"
                checked={optionKeys.includes(option.key)}
                onChange={() => toggleOption(option.key)}
              />
              <span className={styles.optionText}>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              {option.requiresCamera && (
                <span className={styles.cameraBadge}>
                  <Camera size={12} aria-hidden="true" />
                  {copy.cameraRequiredBadge}
                </span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.formStep} hidden={step !== 3}>
        <legend>{stepLegends[3]?.legend}</legend>
        <p>{stepLegends[3]?.intro}</p>
        <div className={styles.choiceGrid}>
          {copy.durations.map((entry) => (
            <label className={styles.choice} key={entry.id}>
              <input
                type="radio"
                name="duration"
                value={entry.id}
                checked={durationId === entry.id}
                onChange={() => setDurationId(entry.id)}
              />
              <span>{entry.label}</span>
            </label>
          ))}
        </div>
        {durationId === "custom" && (
          <label className={styles.textField}>
            <span>{copy.customDurationLabel}</span>
            <input
              type="number"
              min={5}
              max={180}
              value={customMinutes}
              onChange={(event) => setCustomMinutes(Number(event.target.value) || 30)}
            />
          </label>
        )}
      </fieldset>

      <fieldset className={styles.formStep} hidden={step !== 4}>
        <legend>{stepLegends[4]?.legend}</legend>
        <p>{stepLegends[4]?.intro}</p>
        <dl className={styles.reviewList}>
          <div>
            <dt>{copy.steps.child.legend}</dt>
            <dd>{child?.name}</dd>
          </div>
          <div>
            <dt>{copy.steps.assignment.legend}</dt>
            <dd>{assignmentName}</dd>
          </div>
          <div>
            <dt>{copy.steps.options.legend}</dt>
            <dd>{optionKeys.length}</dd>
          </div>
          <div>
            <dt>{copy.steps.duration.legend}</dt>
            <dd>{durationMinutes} min</dd>
          </div>
        </dl>
      </fieldset>

      <div className={styles.formActions}>
        {step > 0 && (
          <button type="button" className={styles.formBack} onClick={back}>
            <ChevronLeft size={18} aria-hidden="true" />
            {copy.back}
          </button>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <button type="button" className={styles.formNext} onClick={next}>
            {copy.next}
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className={styles.formSubmit} onClick={start}>
            <PlayCircle size={18} aria-hidden="true" />
            {copy.start}
          </button>
        )}
      </div>
    </div>
  );
}
