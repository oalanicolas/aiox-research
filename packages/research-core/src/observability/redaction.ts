import type { JsonObject, ResearchRuntimeEvent } from '../types.ts';

export interface RedactionReport {
  count: number;
  types: string[];
}

export interface RedactionResult<T> {
  value: T;
  report: RedactionReport;
}

interface PatternRule {
  type: string;
  pattern: RegExp;
  replacement: string;
}

const SENSITIVE_KEY_PATTERN =
  /^(api[_-]?key|authorization|password|secret|access[_-]?token|refresh[_-]?token|bearer[_-]?token|auth[_-]?token|client[_-]?secret)$/i;

const TEXT_RULES: PatternRule[] = [
  {
    type: 'private_key',
    pattern: /-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },
  {
    type: 'authorization_header',
    pattern: /(Authorization\s*:\s*(?:Bearer|Basic)\s+)[^\s]+/gi,
    replacement: '$1[REDACTED_AUTH]',
  },
  {
    type: 'bearer_token',
    pattern: /(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi,
    replacement: '$1[REDACTED_BEARER]',
  },
  {
    type: 'api_key',
    pattern: /\b(sk-[A-Za-z0-9_-]{10,})\b/g,
    replacement: '[REDACTED_API_KEY]',
  },
  {
    type: 'url_secret',
    pattern: /([?&](?:api_key|key|token|secret|password|access_token)=)[^&\s]+/gi,
    replacement: '$1[REDACTED_SECRET]',
  },
  {
    type: 'assignment_secret',
    pattern: /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|secret)(["'\s:=]+)([^"'\s,&]+)/gi,
    replacement: '$1$2[REDACTED_SECRET]',
  },
];

export function redactText(input: string): RedactionResult<string> {
  let value = input;
  const types = new Set<string>();
  let count = 0;

  for (const rule of TEXT_RULES) {
    value = value.replace(rule.pattern, (match) => {
      count += 1;
      types.add(rule.type);
      const localPattern = new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', ''));
      return match.replace(localPattern, rule.replacement);
    });
  }

  return {
    value,
    report: {
      count,
      types: [...types].sort(),
    },
  };
}

export function redactJsonValue<T>(input: T): RedactionResult<T> {
  const report: RedactionReport = { count: 0, types: [] };
  const value = redactUnknown(input, report, undefined) as T;

  return {
    value,
    report: {
      count: report.count,
      types: [...new Set(report.types)].sort(),
    },
  };
}

export function redactResearchRuntimeEvent(event: ResearchRuntimeEvent): RedactionResult<ResearchRuntimeEvent> {
  return redactJsonValue(event);
}

function redactUnknown(input: unknown, report: RedactionReport, key: string | undefined): unknown {
  if (typeof input === 'string') {
    if (key && SENSITIVE_KEY_PATTERN.test(key)) {
      report.count += 1;
      report.types.push('sensitive_key');
      return '[REDACTED_SECRET]';
    }

    const redacted = redactText(input);
    mergeReport(report, redacted.report);
    return redacted.value;
  }

  if (typeof input === 'number' || typeof input === 'boolean' || input === null || input === undefined) {
    if (key && SENSITIVE_KEY_PATTERN.test(key) && input !== undefined && input !== null) {
      report.count += 1;
      report.types.push('sensitive_key');
      return '[REDACTED_SECRET]';
    }

    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactUnknown(item, report, undefined));
  }

  if (isJsonObject(input)) {
    const out: JsonObject = {};
    for (const [childKey, value] of Object.entries(input)) {
      out[childKey] = redactUnknown(value, report, childKey) as JsonObject[string];
    }
    return out;
  }

  return input;
}

function mergeReport(target: RedactionReport, source: RedactionReport): void {
  target.count += source.count;
  target.types.push(...source.types);
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}
