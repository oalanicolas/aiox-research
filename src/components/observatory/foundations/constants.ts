/* Observatory — corpus-agnostic constants shared across sources.
 * Source-specific enums (CategorySlug for research, BenchType for bench)
 * live in the corresponding adapter. */

export type ObservatorySource = "research" | "bench" | "sinkra-maps" | "demo"

export const OBSERVATORY_SOURCES: Array<[ObservatorySource, string]> = [
  ["research", "Research"],
  ["bench", "Bench"],
  ["sinkra-maps", "SINKRA Maps"],
  ["demo", "Demo"],
]

/* Filter / sort / group — universal */
export type SortKey = "recent" | "oldest" | "coverage" | "alpha"
export type StatusKey = "all" | "completed" | "partial" | "missing" | "legacy"
export type GroupKey = "category" | "month" | "status" | "none"
export type QualityKey = "all" | "rich" | "shallow" | "metadata-only" | "no-data"

/* Inspector tabs — universal core; adapters may add source-specific tabs */
export type InspectorTab =
  | "files"
  | "health"
  | "sources"
  | "players"
  | "personas"
  | "tco"
  | "decision"
  | "gaps"
  | "metadata"

/* Reader modes — Document is universal; rich modes appear only when the source provides them */
export type ReaderMode =
  | "document"
  | "overview"
  | "map"
  | "slides"
  | "roadmap"
  | "recommendations"
  | "curiosity"
  | "waves"
  | "sources"
  | "players"
  | "score"
  | "matrix"
  | "duel"
  | "personas"
  | "tco"
  | "coverage"
  | "decision"
  | "weights"
  | "workflow"
  | "tasks"
  | "gates"
  | "flow"
  | "automation"
  | "governance"
  | "accountability"
  | "gaps"
  | "evidence"

export type TierFilterKey = "all" | 1 | 2 | 3

export const SORTS: Array<[SortKey, string]> = [
  ["recent", "recente"],
  ["oldest", "antiga"],
  ["coverage", "coverage"],
  ["alpha", "A→Z"],
]

export const STATUSES: Array<[StatusKey, string]> = [
  ["all", "todas"],
  ["completed", "completa"],
  ["partial", "parcial"],
  ["missing", "sem métricas"],
  ["legacy", "legado"],
]

export const STATUS_LABEL_PLURAL: Record<StatusKey, string> = {
  all: "todas",
  completed: "completas",
  partial: "parciais",
  missing: "sem métricas",
  legacy: "legado",
}

export const GROUPS: Array<[GroupKey, string]> = [
  ["category", "categoria"],
  ["month", "mês"],
  ["status", "status"],
  ["none", "nenhum"],
]

export const QUALITIES: Array<[QualityKey, string]> = [
  ["all", "qualidade"],
  ["rich", "ricos"],
  ["shallow", "rasos"],
  ["metadata-only", "só metadata"],
  ["no-data", "sem dados"],
]

export const MONTHS_PT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
