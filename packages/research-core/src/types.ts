export type SourceCredibility = 'unknown' | 'low' | 'medium' | 'high';

export type SourceMetadata = Record<string, unknown>;

export type JsonObject = Record<string, unknown>;

export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  description?: string;
  enum?: unknown[];
  items?: JsonSchema;
}

export interface Source {
  index: number;
  title: string;
  url: string;
  snippet?: string;
  content?: string;
  sourceEngine: string;
  publishedDate?: string;
  journal?: string;
  doi?: string;
  authors?: string[];
  credibility?: SourceCredibility;
  metadata?: SourceMetadata;
}

export type SourceInput = Omit<Source, 'index' | 'sourceEngine'>;

export type SourceInputWithEngine = Omit<Source, 'index'>;

export interface Collector {
  add(results: SourceInput[], engineName: string): Promise<number>;
  findByUrl(url: string): number | null;
  findByDoi(doi: string): number | null;
  getAll(): Source[];
  size(): number;
  format(): string;
  reset(): void;
}

export type ResearchMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ResearchMessage {
  role: ResearchMessageRole;
  content?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: JsonObject;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export interface LLMRequest {
  messages: ResearchMessage[];
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { name: string };
  signal?: AbortSignal;
  metadata?: JsonObject;
}

export interface LLMResponse {
  content?: string;
  toolCalls?: ToolCall[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  metadata?: JsonObject;
}

export interface LLMProvider {
  id: string;
  invoke(request: LLMRequest): Promise<LLMResponse>;
}

export type ToolResult = string | JsonObject;

export interface ToolExecutionContext {
  signal?: AbortSignal;
  emit?: (event: ResearchRuntimeEvent) => void;
}

export interface Tool<Args extends JsonObject = JsonObject> extends ToolDefinition {
  execute(args: Args, context?: ToolExecutionContext): Promise<ToolResult> | ToolResult;
}

export interface SearchOptions {
  limit?: number;
  signal?: AbortSignal;
  metadata?: JsonObject;
}

export interface SearchEngine {
  id: string;
  label: string;
  search(query: string, options?: SearchOptions): Promise<SourceInput[]>;
}

export type ResearchRuntimeEvent =
  | {
      type: 'tool_call';
      tool: string;
      args: JsonObject;
      iteration?: number;
    }
  | {
      type: 'tool_result';
      tool: string;
      resultSummary: string;
      iteration?: number;
    }
  | {
      type: 'provider_request';
      provider: string;
      toolsCount: number;
      iteration?: number;
    }
  | {
      type: 'provider_response';
      provider: string;
      toolCallsCount: number;
      iteration?: number;
    };
