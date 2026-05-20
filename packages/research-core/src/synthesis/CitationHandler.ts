import type { LLMProvider, Source } from '../types';

export interface CitationValidationResult {
  text: string;
  validCitations: number[];
  invalidCitations: number[];
}

export interface CitationSynthesisInput {
  question: string;
  sources: Source[];
  previousAnswer?: string;
}

export interface CitationSynthesisResult extends CitationValidationResult {
  rawText: string;
}

export class CitationHandler {
  private readonly llm: LLMProvider;

  constructor(llm: LLMProvider) {
    this.llm = llm;
  }

  async synthesize(input: CitationSynthesisInput): Promise<CitationSynthesisResult> {
    const sourcesBlock = formatSourcesForCitations(input.sources);
    const previousAnswerBlock = input.previousAnswer
      ? `\nPrevious draft:\n${input.previousAnswer}\n`
      : '';
    const response = await this.llm.invoke({
      messages: [
        {
          role: 'system',
          content:
            'You synthesize research using only source indices provided by the user. Cite with [N] format.',
        },
        {
          role: 'user',
          content: [
            `Question: ${input.question}`,
            '',
            'Available sources:',
            sourcesBlock,
            previousAnswerBlock,
            'Write a rigorous answer. Use [N] citations only when N exists in the available sources.',
          ].join('\n'),
        },
      ],
      toolChoice: 'none',
    });
    const rawText = response.content ?? '';
    const validation = validateCitations(rawText, input.sources);

    return {
      rawText,
      ...validation,
    };
  }
}

export function formatSourcesForCitations(sources: Source[]): string {
  if (sources.length === 0) {
    return 'No sources collected.';
  }

  return sources
    .map((source) => {
      const snippet = source.snippet ? `\n${source.snippet}` : '';
      return `[${source.index}] ${source.title} (${source.url})${snippet}`;
    })
    .join('\n\n');
}

export function validateCitations(text: string, sources: Source[]): CitationValidationResult {
  const validIndices = new Set(sources.map((source) => source.index));
  const validCitations = new Set<number>();
  const invalidCitations = new Set<number>();
  const sanitized = text.replace(/\[(\d+)\]/g, (match, rawIndex: string) => {
    const index = Number.parseInt(rawIndex, 10);

    if (validIndices.has(index)) {
      validCitations.add(index);
      return match;
    }

    invalidCitations.add(index);
    return '';
  });

  return {
    text: sanitized,
    validCitations: [...validCitations].sort((a, b) => a - b),
    invalidCitations: [...invalidCitations].sort((a, b) => a - b),
  };
}
