import type { ReactNode } from "react";

export const PART_NAMES: Record<string, string> = {
  "1": "Part 1 照片描述",
  "2": "Part 2 應答問題",
  "3": "Part 3 簡短對話",
  "4": "Part 4 簡短獨白",
  "5": "Part 5 句子填空",
  "6": "Part 6 段落填空",
  "7": "Part 7 閱讀理解",
};

type Labeled = { label: string; text: string };

interface Payload {
  photo?: string;
  statements?: Labeled[];
  prompt?: string;
  options?: Labeled[] | string[];
  sentence?: string;
  passage?: string;
  topic?: string;
  turns?: { speaker: string; text: string }[];
  questions?: {
    number?: number;
    blank_number?: number;
    text?: string;
    question?: string;
    options: Labeled[] | string[];
    answer: string | number;
    explanation?: string;
  }[];
  answer?: string | number;
  explanation?: string;
}

/** 把命中的字形標粗體。英文比對整字，中文照字面。 */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const pattern = highlightPattern(terms);
  if (!pattern) return <>{text}</>;
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const at = m.index ?? 0;
    if (at > last) nodes.push(text.slice(last, at));
    nodes.push(
      <strong key={at} className="font-semibold text-primary">
        {m[0]}
      </strong>,
    );
    last = at + m[0].length;
  }
  nodes.push(text.slice(last));
  return <>{nodes}</>;
}

function highlightPattern(terms: string[]): RegExp | null {
  const cleaned = terms.filter(Boolean);
  if (cleaned.length === 0) return null;
  const escaped = [...cleaned]
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const english = cleaned.every((t) => /^[a-z' -]+$/i.test(t));
  const body = escaped.join("|");
  return new RegExp(english ? `\\b(?:${body})\\b` : `(?:${body})`, "gi");
}

/** 選項統一成「代號加文字」。Part 5/6/7 的選項是純文字陣列，代號依序給 A 到 D。 */
function labeled(options: Labeled[] | string[] | undefined): Labeled[] {
  if (!options) return [];
  return options.map((o, i) =>
    typeof o === "string" ? { label: "ABCD"[i] ?? String(i + 1), text: o } : o,
  );
}

/** 正解對應到的選項代號：Part 7 是 1 起算序號，Part 5/6 是選項文字，聽力是代號。 */
function answerLabel(options: Labeled[], answer: string | number | undefined): string {
  if (answer === undefined) return "";
  if (typeof answer === "number") return options[answer - 1]?.label ?? "";
  return options.find((o) => o.text === answer)?.label ?? answer;
}

function Options({
  options,
  answer,
  terms,
}: {
  options: Labeled[];
  answer: string;
  terms: string[];
}) {
  return (
    <ul className="space-y-1">
      {options.map((o) => {
        const correct = o.label === answer;
        return (
          <li key={o.label} className={correct ? "font-medium text-foreground" : undefined}>
            <span className="mr-2 tabular-nums">({o.label})</span>
            <Highlight text={o.text} terms={terms} />
            {correct ? <span className="ml-2 text-xs text-[var(--tone-good)]">正解</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

function Explanation({ text, terms }: { text?: string; terms: string[] }) {
  if (!text) return null;
  return (
    <p className="border-l-2 border-border pl-3 text-muted-foreground">
      <Highlight text={text} terms={terms} />
    </p>
  );
}

/** 依 Part 展開整題、正解與解析。 */
export function QuestionDetail({ part, payload, terms }: { part: string; payload: unknown; terms: string[] }) {
  const q = (payload ?? {}) as Payload;

  if (part === "1") {
    const options = labeled(q.statements);
    return (
      <div className="space-y-3 text-sm leading-7">
        {q.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/${q.photo}`} alt="題目照片" className="max-h-64 border border-border" loading="lazy" />
        ) : null}
        <Options options={options} answer={answerLabel(options, q.answer)} terms={terms} />
        <Explanation text={q.explanation} terms={terms} />
      </div>
    );
  }

  if (part === "2" || part === "5") {
    const options = labeled(q.options);
    return (
      <div className="space-y-3 text-sm leading-7">
        <p className="font-medium">
          <Highlight text={(part === "2" ? q.prompt : q.sentence) ?? ""} terms={terms} />
        </p>
        <Options options={options} answer={answerLabel(options, q.answer)} terms={terms} />
        <Explanation text={q.explanation} terms={terms} />
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm leading-7">
      {q.turns ? (
        <div className="space-y-1">
          {q.turns.map((turn, i) => (
            <p key={i}>
              <span className="mr-2 text-muted-foreground">{turn.speaker}</span>
              <Highlight text={turn.text} terms={terms} />
            </p>
          ))}
        </div>
      ) : null}
      {q.passage ? (
        <p className="whitespace-pre-line border border-border bg-card p-3">
          <Highlight text={q.passage} terms={terms} />
        </p>
      ) : null}
      {(q.questions ?? []).map((item, i) => {
        const options = labeled(item.options);
        const heading =
          item.text ?? item.question ?? (item.blank_number ? `第 ${item.blank_number} 格` : "");
        return (
          <div key={i} className="space-y-2">
            <p className="font-medium">
              <span className="mr-2 tabular-nums">{item.number ?? i + 1}.</span>
              <Highlight text={heading} terms={terms} />
            </p>
            <Options options={options} answer={answerLabel(options, item.answer)} terms={terms} />
            <Explanation text={item.explanation} terms={terms} />
          </div>
        );
      })}
    </div>
  );
}
