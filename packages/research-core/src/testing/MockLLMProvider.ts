import type { LLMProvider, LLMRequest, LLMResponse } from '../types';

export interface MockLLMProviderConfig {
  id?: string;
  responses?: LLMResponse[];
  handler?: (request: LLMRequest, index: number) => LLMResponse | Promise<LLMResponse>;
}

export class MockLLMProvider implements LLMProvider {
  readonly id: string;

  private readonly responses: LLMResponse[];
  private readonly handler?: MockLLMProviderConfig['handler'];
  private readonly requests: LLMRequest[] = [];

  constructor(config: MockLLMProviderConfig = {}) {
    this.id = config.id ?? 'mock-llm';
    this.responses = config.responses ? cloneResponses(config.responses) : [];
    this.handler = config.handler;
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    const requestSnapshot = cloneRequest(request);
    this.requests.push(requestSnapshot);

    if (this.handler) {
      return cloneResponse(await this.handler(requestSnapshot, this.requests.length - 1));
    }

    const response = this.responses.shift();

    if (!response) {
      throw new Error(`MockLLMProvider ${this.id} has no scripted response left`);
    }

    return cloneResponse(response);
  }

  getRequests(): LLMRequest[] {
    return this.requests.map(cloneRequest);
  }
}

function cloneResponses(responses: LLMResponse[]): LLMResponse[] {
  return responses.map(cloneResponse);
}

function cloneResponse(response: LLMResponse): LLMResponse {
  return structuredClone(response);
}

function cloneRequest(request: LLMRequest): LLMRequest {
  return {
    ...structuredClone({
      messages: request.messages,
      tools: request.tools,
      toolChoice: request.toolChoice,
      metadata: request.metadata,
    }),
    signal: request.signal,
  };
}
