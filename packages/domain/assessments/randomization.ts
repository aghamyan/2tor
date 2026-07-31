import type {
  AssessmentChoice,
  AssessmentQuestionRecord,
  AssessmentVersionRecord,
  PresentedQuestion,
} from "./models";

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function generator(seed: string): () => number {
  let value = hash(seed);
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function deterministicShuffle<T>(values: readonly T[], seed: string): T[] {
  const random = generator(seed);
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex] as T;
    shuffled[swapIndex] = current as T;
  }
  return shuffled;
}

function selectQuestions(
  version: AssessmentVersionRecord,
  seed: string,
): AssessmentQuestionRecord[] {
  const pooled = new Map<string, AssessmentQuestionRecord[]>();
  const selected: AssessmentQuestionRecord[] = [];

  for (const question of version.questions) {
    if (!question.poolId) {
      selected.push(question);
      continue;
    }
    const questions = pooled.get(question.poolId) ?? [];
    questions.push(question);
    pooled.set(question.poolId, questions);
  }

  for (const [poolId, questions] of pooled) {
    const requested = version.settings.poolSelections[poolId] ?? questions.length;
    selected.push(...deterministicShuffle(questions, `${seed}:pool:${poolId}`).slice(0, requested));
  }

  const ordered = selected.sort((left, right) => left.orderIndex - right.orderIndex);
  return version.settings.randomizeQuestionOrder
    ? deterministicShuffle(ordered, `${seed}:question-order`)
    : ordered;
}

function renderPrompt(question: AssessmentQuestionRecord, seed: string): string {
  let prompt = question.prompt;
  for (const rule of question.randomValues) {
    const random = generator(`${seed}:${question.id}:value:${rule.name}`);
    const steps = Math.floor((rule.max - rule.min) / rule.step);
    const value = rule.min + Math.floor(random() * (steps + 1)) * rule.step;
    prompt = prompt.replaceAll(`{{${rule.name}}}`, String(Number(value.toFixed(10))));
  }
  return prompt;
}

function presentChoices(choices: AssessmentChoice[] | null, randomize: boolean, seed: string) {
  if (!choices || !randomize) return choices;
  return deterministicShuffle(choices, seed);
}

export function presentAssessmentQuestions(
  version: AssessmentVersionRecord,
  seed: string,
  selectedQuestionIds?: readonly string[],
): PresentedQuestion[] {
  const questions = selectedQuestionIds
    ? selectedQuestionIds
        .map((questionId) => version.questions.find((question) => question.id === questionId))
        .filter((question): question is AssessmentQuestionRecord => question !== undefined)
    : selectQuestions(version, seed);

  return questions.map((question, orderIndex) => ({
    id: question.id,
    orderIndex,
    type: question.type,
    prompt: renderPrompt(question, seed),
    choices: presentChoices(
      question.choices,
      question.randomizeOptions,
      `${seed}:${question.id}:choices`,
    ),
    points: question.points,
  }));
}
