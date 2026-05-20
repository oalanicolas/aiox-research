import type { JsonObject, Tool } from '../types';
import { assertSafeFetchUrl } from '../security/ssrf-validator.ts';

export interface FetchUrlArgs extends JsonObject {
  url?: unknown;
  focus?: unknown;
}

export interface FetchUrlToolConfig {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxChars?: number;
}

export function createFetchUrlTool(config: FetchUrlToolConfig = {}): Tool<FetchUrlArgs> {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const timeoutMs = config.timeoutMs ?? 10_000;
  const maxChars = config.maxChars ?? 12_000;

  return {
    name: 'fetch_url',
    description: 'Fetches a public HTTP(S) URL and returns extracted text content.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Public HTTP(S) URL to fetch.',
        },
        focus: {
          type: 'string',
          description: 'Optional focus hint retained in the returned content header.',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
    async execute(args, context) {
      if (typeof args.url !== 'string' || args.url.trim().length === 0) {
        return 'Fetch failed: url is required.';
      }

      let parsed: URL;

      try {
        parsed = assertSafeFetchUrl(args.url.trim());
      } catch (error) {
        return `Fetch failed for "${args.url}": ${
          error instanceof Error ? error.message : String(error)
        }.`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const abortFromContext = () => controller.abort();
      context?.signal?.addEventListener('abort', abortFromContext, { once: true });

      try {
        const response = await fetchImpl(parsed.toString(), {
          headers: {
            'user-agent': 'AIOX Research Core/0.1 (+https://sinkra.ai)',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          return `Fetch failed for "${parsed.toString()}": HTTP ${response.status}.`;
        }

        const rawText = await response.text();
        const text = extractReadableText(rawText).slice(0, maxChars);
        const focus = typeof args.focus === 'string' && args.focus.trim().length > 0
          ? `\nFocus: ${args.focus.trim()}`
          : '';

        return `Fetched ${parsed.toString()}${focus}\n\n${text}`;
      } catch (error) {
        return `Fetch failed for "${parsed.toString()}": ${
          error instanceof Error ? error.message : String(error)
        }.`;
      } finally {
        clearTimeout(timeout);
        context?.signal?.removeEventListener('abort', abortFromContext);
      }
    },
  };
}

export function extractReadableText(input: string): string {
  return decodeHtmlEntities(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
