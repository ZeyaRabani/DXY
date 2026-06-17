import type { Filter, QueryPlan } from "../plan";
import { getField, type SourceId } from "../datasets";

export interface ParseResult {
  plan: QueryPlan;
  // Human-readable summary of how the question was understood.
  interpretation: string;
  // Phrases we matched, for transparency in the UI.
  matched: string[];
  // True when we were confident enough to build a meaningful plan.
  understood: boolean;
  source: "parser" | "llm";
}

const WEEKDAY: Record<string, string> = {
  monday: "mon", mon: "mon",
  tuesday: "tue", tues: "tue", tue: "tue",
  wednesday: "wed", weds: "wed", wed: "wed",
  thursday: "thu", thurs: "thu", thur: "thu", thu: "thu",
  friday: "fri", fri: "fri",
  saturday: "sat", sat: "sat",
  sunday: "sun", sun: "sun",
};
const DAY_ALT = Object.keys(WEEKDAY).join("|");

const BIAS: Record<string, string> = {
  bullish: "bullish", bull: "bullish", up: "bullish", green: "bullish",
  higher: "bullish", positive: "bullish", gain: "bullish", gained: "bullish",
  bearish: "bearish", bear: "bearish", down: "bearish", red: "bearish",
  lower: "bearish", negative: "bearish", loss: "bearish", fell: "bearish",
};
const BIAS_ALT = Object.keys(BIAS).join("|");

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function rangeField(dataset: SourceId): string {
  if (dataset === "weekly") return "w_range";
  if (dataset === "monthly") return "m_range";
  return "d_range";
}

interface Target {
  dataset: SourceId;
  targetField: string;
  label: string;
  // True when the question explicitly named the period+close (vs a weak guess).
  explicit: boolean;
}

// Detect which dataset/target the question is about.
function detectTarget(q: string): Target {
  // Ordered, most-specific first.
  if (/\bweek(ly)?\s+(close|candle|bias)\b/.test(q) || /\bclose\s+of\s+the\s+week\b/.test(q)) {
    return { dataset: "weekly", targetField: "w_close", label: "weekly close", explicit: true };
  }
  if (/\bmonth(ly)?\s+(close|candle|bias)\b/.test(q) || /\bclose\s+of\s+the\s+month\b/.test(q)) {
    return { dataset: "monthly", targetField: "m_close", label: "monthly close", explicit: true };
  }
  if (/\b(day|daily)\s+(close|candle|bias)\b/.test(q) || /\bclose\s+of\s+the\s+day\b/.test(q)) {
    return { dataset: "daily", targetField: "d_close", label: "daily close", explicit: true };
  }
  // Weaker keyword-only signals.
  if (/\bweek(ly)?\b/.test(q)) return { dataset: "weekly", targetField: "w_close", label: "weekly close", explicit: false };
  if (/\bmonth(ly)?\b/.test(q)) return { dataset: "monthly", targetField: "m_close", label: "monthly close", explicit: false };
  return { dataset: "daily", targetField: "d_close", label: "daily close", explicit: false };
}

const REFINEMENT_CUE = /^\s*(so|and|then|what about|how about|now|ok|okay|also|but|what if)\b/i;

interface MatchSpec {
  re: RegExp;
  build: (m: RegExpExecArray, dataset: SourceId) => Filter | null;
  describe: (m: RegExpExecArray) => string;
  // Only valid as a filter on datasets that have the field.
  field: string;
}

function biasFilter(field: string): MatchSpec["build"] {
  return (m, dataset) => {
    if (!getField(dataset, field)) return null;
    const val = BIAS[m[m.length - 1]];
    return val ? { field, op: "eq", value: val } : null;
  };
}

function weekdayFilter(field: string): MatchSpec["build"] {
  return (m, dataset) => {
    if (!getField(dataset, field)) return null;
    const val = WEEKDAY[m[m.length - 1]];
    return val ? { field, op: "eq", value: val } : null;
  };
}

const SPECS: MatchSpec[] = [
  // Weekly high / low day
  {
    field: "wh",
    re: new RegExp(`(?:high of the week|weekly high|week'?s? high|week high|wh)\\s*(?:was|is|on|=|:|in|fell on|made on)?\\s*(?:a |an |the )?(${DAY_ALT})`, "i"),
    build: weekdayFilter("wh"),
    describe: (m) => `weekly high on ${WEEKDAY[m[1].toLowerCase()]}`,
  },
  {
    field: "wl",
    re: new RegExp(`(?:low of the week|weekly low|week'?s? low|week low|wl)\\s*(?:was|is|on|=|:|in|fell on|made on)?\\s*(?:a |an |the )?(${DAY_ALT})`, "i"),
    build: weekdayFilter("wl"),
    describe: (m) => `weekly low on ${WEEKDAY[m[1].toLowerCase()]}`,
  },
  // Day-adjacent weekly high/low phrasing: "Monday high", "high on Monday",
  // "Friday low", "low was Friday" (no explicit "week" qualifier needed).
  {
    field: "wh",
    re: new RegExp(`(${DAY_ALT})\\s+(?:was\\s+(?:the\\s+)?)?(?:weekly\\s+|week'?s?\\s+)?high\\b`, "i"),
    build: weekdayFilter("wh"),
    describe: (m) => `weekly high on ${WEEKDAY[m[1].toLowerCase()]}`,
  },
  {
    field: "wh",
    re: new RegExp(`\\bhigh\\s+(?:of the week\\s+)?(?:was|made|set|on|in|=|:)\\s*(?:made\\s+)?(?:a |an |the )?(${DAY_ALT})`, "i"),
    build: weekdayFilter("wh"),
    describe: (m) => `weekly high on ${WEEKDAY[m[1].toLowerCase()]}`,
  },
  {
    field: "wl",
    re: new RegExp(`(${DAY_ALT})\\s+(?:was\\s+(?:the\\s+)?)?(?:weekly\\s+|week'?s?\\s+)?low\\b`, "i"),
    build: weekdayFilter("wl"),
    describe: (m) => `weekly low on ${WEEKDAY[m[1].toLowerCase()]}`,
  },
  {
    field: "wl",
    re: new RegExp(`\\blow\\s+(?:of the week\\s+)?(?:was|made|set|on|in|=|:)\\s*(?:made\\s+)?(?:a |an |the )?(${DAY_ALT})`, "i"),
    build: weekdayFilter("wl"),
    describe: (m) => `weekly low on ${WEEKDAY[m[1].toLowerCase()]}`,
  },
  // Previous-period closes (check before plain period closes)
  {
    field: "prev_week_close",
    re: new RegExp(`(?:previous|prior|last)\\s+week'?s?\\s+close\\s*(?:was|is|=|:)?\\s*(${BIAS_ALT})`, "i"),
    build: biasFilter("prev_week_close"),
    describe: (m) => `previous week close ${BIAS[m[1].toLowerCase()]}`,
  },
  {
    field: "prev_month_close",
    re: new RegExp(`(?:previous|prior|last)\\s+month'?s?\\s+close\\s*(?:was|is|=|:)?\\s*(${BIAS_ALT})`, "i"),
    build: biasFilter("prev_month_close"),
    describe: (m) => `previous month close ${BIAS[m[1].toLowerCase()]}`,
  },
  {
    field: "prev_day_close",
    re: new RegExp(`(?:previous|prior|last|yesterday'?s?)\\s+(?:day'?s?\\s+)?close\\s*(?:was|is|=|:)?\\s*(${BIAS_ALT})`, "i"),
    build: biasFilter("prev_day_close"),
    describe: (m) => `previous day close ${BIAS[m[1].toLowerCase()]}`,
  },
  // Period closes as filters
  {
    field: "m_close",
    re: new RegExp(`(?:month(?:ly)?\\s+(?:close|candle)|close of the month)\\s*(?:was|is|=|:|ended|closed)?\\s*(${BIAS_ALT})`, "i"),
    build: biasFilter("m_close"),
    describe: (m) => `monthly close ${BIAS[m[1].toLowerCase()]}`,
  },
  {
    field: "w_close",
    re: new RegExp(`(?:week(?:ly)?\\s+(?:close|candle)|close of the week)\\s*(?:was|is|=|:|ended|closed)?\\s*(${BIAS_ALT})`, "i"),
    build: biasFilter("w_close"),
    describe: (m) => `weekly close ${BIAS[m[1].toLowerCase()]}`,
  },
  {
    field: "d_close",
    re: new RegExp(`(?:day(?:'?s)?|daily)\\s+(?:close|candle)\\s*(?:was|is|=|:|ended|closed)?\\s*(${BIAS_ALT})`, "i"),
    build: biasFilter("d_close"),
    describe: (m) => `daily close ${BIAS[m[1].toLowerCase()]}`,
  },
  // Range comparisons
  {
    field: "range_between",
    re: /range\s*(?:was|is)?\s*between\s*(\d+)\s*(?:and|-|to)\s*(\d+)/i,
    build: (m, dataset) => ({ field: rangeField(dataset), op: "between", value: [Number(m[1]), Number(m[2])] }),
    describe: (m) => `range between ${m[1]} and ${m[2]}`,
  },
  {
    field: "range_gte",
    re: /range\s*(?:was|is)?\s*(?:greater than|over|above|more than|>=?|at least)\s*(\d+)/i,
    build: (m, dataset) => ({ field: rangeField(dataset), op: "gte", value: Number(m[1]) }),
    describe: (m) => `range ≥ ${m[1]}`,
  },
  {
    field: "range_lte",
    re: /range\s*(?:was|is)?\s*(?:less than|under|below|smaller than|<=?|at most)\s*(\d+)/i,
    build: (m, dataset) => ({ field: rangeField(dataset), op: "lte", value: Number(m[1]) }),
    describe: (m) => `range ≤ ${m[1]}`,
  },
  // Event weeks
  {
    field: "cpi_week",
    re: /\bcpi\b|inflation\s+(?:week|print|report)/i,
    build: (m, dataset) => (getField(dataset, "cpi_week") ? { field: "cpi_week", op: "eq", value: true } : null),
    describe: () => "CPI week",
  },
  {
    field: "nfp_week",
    re: /\bnfp\b|non[-\s]?farm|payroll/i,
    build: (m, dataset) => (getField(dataset, "nfp_week") ? { field: "nfp_week", op: "eq", value: true } : null),
    describe: () => "NFP week",
  },
  {
    field: "event_type_normal",
    re: /\bnormal\s+week\b|\bquiet\s+week\b|non[-\s]?event\s+week/i,
    build: (m, dataset) => (getField(dataset, "event_type") ? { field: "event_type", op: "eq", value: "normal" } : null),
    describe: () => "normal (non-event) week",
  },
  {
    field: "event_week",
    re: /\bevent\s+week\b/i,
    build: (m, dataset) => (getField(dataset, "event_week") ? { field: "event_week", op: "eq", value: true } : null),
    describe: () => "event week",
  },
  // Year
  {
    field: "year",
    re: /\b(?:in|year|during)\s+((?:19|20)\d\d)\b/i,
    build: (m, dataset) => {
      const f = getField(dataset, "year") ? "year" : getField(dataset, "iso_year") ? "iso_year" : null;
      return f ? { field: f, op: "eq", value: Number(m[1]) } : null;
    },
    describe: (m) => `year ${m[1]}`,
  },
];

function consume(s: string, re: RegExp): { match: RegExpExecArray | null; rest: string } {
  const m = re.exec(s);
  if (!m) return { match: null, rest: s };
  const rest = s.slice(0, m.index) + " ".repeat(m[0].length) + s.slice(m.index + m[0].length);
  return { match: m, rest };
}

// Deterministic natural-language -> query plan parser. An optional previous plan
// lets follow-up questions inherit still-relevant filters from the prior turn.
export function parseQuestion(question: string, prevPlan?: QueryPlan | null): ParseResult {
  const original = question.trim();
  let q = ` ${original.toLowerCase().replace(/[?!.]/g, " ").replace(/\s+/g, " ")} `;
  const target = detectTarget(q);
  const filters: Filter[] = [];
  const matched: string[] = [];

  for (const spec of SPECS) {
    const { match, rest } = consume(q, spec.re);
    if (match) {
      const f = spec.build(match, target.dataset);
      if (f && !filters.some((existing) => existing.field === f.field)) {
        filters.push(f);
        matched.push(spec.describe(match));
        q = rest;
      }
    }
  }

  // wh/wl are weekly concepts. If the user asked about a weekly-high/low day but
  // we only weakly guessed "daily", promote the question to the weekly dataset.
  if (!target.explicit && target.dataset === "daily" && filters.some((f) => f.field === "wh" || f.field === "wl")) {
    target.dataset = "weekly";
    target.targetField = "w_close";
    target.label = "weekly close";
  }

  // A bare weekday left in the text (e.g. "on Mondays") becomes a daily weekday
  // filter only for the daily dataset, since wh/wl already consumed their days.
  if (target.dataset === "daily" && !filters.some((f) => f.field === "day")) {
    const dm = new RegExp(`\\b(${DAY_ALT})s?\\b`, "i").exec(q);
    if (dm) {
      filters.push({ field: "day", op: "eq", value: WEEKDAY[dm[1].toLowerCase()] });
      matched.push(`weekday ${WEEKDAY[dm[1].toLowerCase()]}`);
    }
  }

  // A bare month name (for monthly/daily datasets) becomes a month filter.
  if (!filters.some((f) => f.field === "month") && getField(target.dataset, "month")) {
    const monRe = new RegExp(`\\b(${MONTHS.join("|")})\\b`, "i");
    const mm = monRe.exec(q);
    if (mm) {
      const name = mm[1][0].toUpperCase() + mm[1].slice(1).toLowerCase();
      filters.push({ field: "month", op: "eq", value: name });
      matched.push(`month ${name}`);
    }
  }

  // Follow-up inheritance: when this looks like a refinement of the prior turn
  // (a cue word, or no new filters of its own), carry over the previous filters
  // that still apply to the chosen dataset and were not re-specified here.
  const isRefinement = REFINEMENT_CUE.test(original) || filters.length === 0;
  if (prevPlan && isRefinement) {
    for (const pf of prevPlan.filters) {
      if (filters.some((f) => f.field === pf.field)) continue;
      if (!getField(target.dataset, pf.field)) continue;
      filters.push(pf);
      const label = getField(target.dataset, pf.field)?.label ?? pf.field;
      matched.push(`${label} ${Array.isArray(pf.value) ? pf.value.join("\u2013") : String(pf.value)} (from earlier)`);
    }
  }

  const understood = filters.length > 0 || /\b(close|bias|bullish|bearish|distribution|how often)\b/.test(q);

  const interpretation =
    filters.length > 0
      ? `Looking at the ${target.dataset} dataset, counting ${target.label} where ${matched.join(" and ")}.`
      : `Looking at the overall ${target.label} distribution in the ${target.dataset} dataset.`;

  return {
    plan: { dataset: target.dataset, targetField: target.targetField, filters },
    interpretation,
    matched,
    understood,
    source: "parser",
  };
}
