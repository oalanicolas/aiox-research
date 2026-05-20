"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Loader2,
  Mic,
  Plus,
  Radar,
  RefreshCcw,
  Search,
  Settings,
  Square,
  Terminal,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  OPENROUTER_API_BASE_URL,
  OPENROUTER_CLI_LABEL,
  methodById,
  normalizeResearchMethodId,
  normalizeResearchRunRequest,
  RESEARCH_METHODS,
  slugifyResearchTopic,
  type ResearchByokConfig,
  type ResearchCliDiscovery,
  type ResearchCliId,
  type ResearchCliStatus,
  type ResearchMethodId,
  type ResearchPipelinePhaseProgress,
  type ResearchRunRequest,
  type ResearchRunState,
} from "@/lib/research-workbench-contract"
import { DISPLAY_FONT, MONO_FONT, SANS_FONT } from "@/components/observatory/foundations/theme"

type ResearchWorkbenchProps = {
  initialDiscovery: ResearchCliDiscovery
  recentRuns?: RecentResearchRun[]
  initialMethodId?: ResearchMethodId
  initialRunIds?: string[]
  initialConsolidationRunId?: string | null
}

type RecentResearchRun = {
  slug: string
  title: string
  displayTitle: string
  date: string
  status: string
  category: string
  coverage: string
  sources: string
  files: number
  sampleFiles: string[]
  waves: number
}

type ResearchAttachmentResult = {
  name: string
  type: string
  size: number
  path: string
  kind: "audio" | "file"
  transcript?: string
  transcriptionStatus?: "skipped" | "completed" | "failed" | "unavailable"
  transcriptionMessage?: string
  transcriptionProvider?: string
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionResultEventLike = {
  resultIndex: number
  results: SpeechRecognitionResultListLike
}

type SpeechRecognitionErrorEventLike = {
  error?: string
}

type SpeechRecognitionResultListLike = {
  length: number
  [index: number]: SpeechRecognitionResultLike
}

type SpeechRecognitionResultLike = {
  isFinal: boolean
  length: number
  [index: number]: {
    transcript: string
  }
}

type ResearchExecutionMode = "local" | "byok"

const BYOK_STORAGE_KEY = "aiox-research:research-byok"
const RUNTIME_STEP_TOTAL = 7
const MAX_RESEARCH_TOPIC_SLUG_LENGTH = 44

const DEFAULT_BYOK_CONFIG: ResearchByokConfig = {
  providerLabel: OPENROUTER_CLI_LABEL,
  baseUrl: OPENROUTER_API_BASE_URL,
  apiKey: "",
  model: "openai/gpt-4o",
}

const QUICK_RESEARCH_SUGGESTIONS = [
  {
    label: "Mapa de território",
    methodId: "mapping",
    prompt: "Mapear o ecossistema de ferramentas de apresentações com IA em 2026. Entregar taxonomia do mercado, principais categorias, players por categoria, sinais de tração, lacunas ainda mal resolvidas, riscos de adoção e perguntas que precisam virar benchmark depois.",
  },
  {
    label: "Top 10 + bench",
    methodId: "benchmark",
    prompt: "Fazer um benchmark Top 10 das melhores ferramentas de apresentações com IA para times de growth e founders. Comparar Gamma, Canva, Beautiful.ai, Tome, Pitch, Plus AI, Decktopus, SlidesAI, Presenton e alternativas relevantes. Incluir preço, qualidade visual, geração por prompt, edição manual, colaboração, exportação PPT/PDF, maturidade, riscos e recomendação por cenário.",
  },
  {
    label: "Avaliação técnica",
    methodId: "tech",
    prompt: "Avaliar tecnicamente o Presenton como alternativa open source ao Gamma para geração de apresentações com IA. Analisar arquitetura, stack, modelo de extensibilidade, instalação local, qualidade dos exports, dependências, riscos de manutenção, segurança, custo operacional e esforço para adaptar ao ecossistema SINKRA.",
  },
  {
    label: "Cenário competitivo",
    methodId: "market",
    prompt: "Analisar o cenário competitivo de ferramentas de apresentação com IA para B2B SaaS. Comparar posicionamento, ICP, pricing, canais de aquisição, narrativa de produto, diferenciais defendáveis, sinais de demanda, ameaças de incumbentes e oportunidades de entrada para uma solução local-first com design systems.",
  },
] as const satisfies ReadonlyArray<{
  label: string
  methodId: ResearchMethodId
  prompt: string
}>

const AIOX_RESEARCH_THEME = {
  "--paper": "#050505",
  "--paper-alt": "#0F0F11",
  "--paper-deep": "#0A0A0C",
  "--surface": "#0F0F11",
  "--surface-alt": "#18181B",
  "--surface-hover": "#1E1F22",
  "--surface-console": "#111113",
  "--ink": "rgb(244, 244, 232)",
  "--ink-2": "rgba(244, 244, 232, 0.70)",
  "--ink-3": "rgba(244, 244, 232, 0.55)",
  "--ink-dim": "rgba(245, 244, 231, 0.40)",
  "--ink-faint": "rgba(245, 244, 231, 0.07)",
  "--rule": "rgba(156, 156, 156, 0.15)",
  "--rule-soft": "rgba(156, 156, 156, 0.10)",
  "--rule-strong": "rgba(156, 156, 156, 0.25)",
  "--grid-line": "rgba(156, 156, 156, 0.04)",
  "--lime-ink": "#D1FF00",
  "--blue-ink": "#0099FF",
  "--danger-ink": "#EF4444",
  "--warning-ink": "#F59E0B",
} as CSSProperties

export function ResearchWorkbench({
  initialDiscovery,
  recentRuns = [],
  initialMethodId,
  initialRunIds = [],
  initialConsolidationRunId = null,
}: ResearchWorkbenchProps) {
  const router = useRouter()
  const [discovery] = useState(initialDiscovery)
  const [query, setQuery] = useState("")
  const [methodId, setMethodId] = useState<ResearchMethodId>(initialMethodId ?? "mapping")
  const depth: ResearchRunRequest["depth"] = "deep"
  const [selectedCliIds, setSelectedCliIds] = useState<ResearchCliId[]>(() => [preferredCli(initialDiscovery.clis)?.id ?? "claude"])
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioAttachment, setAudioAttachment] = useState<ResearchAttachmentResult | null>(null)
  const [contextFiles, setContextFiles] = useState<File[]>([])
  const [contextAttachments, setContextAttachments] = useState<ResearchAttachmentResult[]>([])
  const [runs, setRuns] = useState<ResearchRunState[]>([])
  const [consolidationRun, setConsolidationRun] = useState<ResearchRunState | null>(null)
  const [focusedRunId, setFocusedRunId] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [isComposerDragActive, setIsComposerDragActive] = useState(false)
  const [isRecordingAudio, setIsRecordingAudio] = useState(false)
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false)
  const [isConsolidating, setIsConsolidating] = useState(false)
  const [retryingRunIds, setRetryingRunIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [methodPickerOpen, setMethodPickerOpen] = useState(false)
  const [executionMode, setExecutionMode] = useState<ResearchExecutionMode>("local")
  const [byokConfig, setByokConfig] = useState<ResearchByokConfig>(DEFAULT_BYOK_CONFIG)
  const audioInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const speechTranscriptRef = useRef("")

  const selectedClis = useMemo(
    () => selectedCliIds.map((cliId) => discovery.clis.find((cli) => cli.id === cliId)).filter((cli): cli is ResearchCliStatus => Boolean(cli)),
    [discovery.clis, selectedCliIds],
  )

  const firstAttachmentName = audioFile?.name ?? audioAttachment?.name ?? contextFiles[0]?.name ?? contextAttachments[0]?.name
  const baseOutputSlug = useMemo(() => slugifyResearchTopic(query || firstAttachmentName || "research-context"), [firstAttachmentName, query])
  const researchOutputSlug = useMemo(() => datedResearchSlug(baseOutputSlug), [baseOutputSlug])

  const runnableSelectedClis = selectedClis.filter((cli) => cli.available && cli.launchSupported)
  const byokReady = Boolean(byokConfig.apiKey.trim() && byokConfig.baseUrl.trim() && byokConfig.model.trim())
  const completedRuns = runs.filter(isWorkflowComplete)
  const visibleSessionRuns = consolidationRun ? [...runs, consolidationRun] : runs
  const sessionMethodId = visibleSessionRuns[0]?.methodId ?? methodId
  const allRunsFinished = runs.length > 0 && runs.every((run) => isWorkflowComplete(run) || isWorkflowFailed(run))
  const canConsolidate = allRunsFinished && completedRuns.length >= 2 && !isConsolidating && consolidationRun?.status !== "running"
  const initialRunIdsKey = initialRunIds.join(",")
  const hasUrlScopedSession = initialRunIds.length > 0 || Boolean(initialConsolidationRunId)
  const hasResearchSession = hasUrlScopedSession || runs.length > 0 || Boolean(consolidationRun)
  const canStart =
    !hasResearchSession &&
    !isRecordingAudio &&
    (query.trim().length >= 8 || Boolean(audioFile || audioAttachment || contextFiles.length > 0 || contextAttachments.length > 0)) &&
    (executionMode === "byok" ? byokReady : runnableSelectedClis.length > 0)
  const activeStreamRunIdsKey = useMemo(() => {
    return visibleSessionRuns
      .filter(isWorkflowPending)
      .map((run) => run.runId)
      .sort()
      .join(",")
  }, [visibleSessionRuns])
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(BYOK_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as Partial<ResearchByokConfig>
      setByokConfig({
        providerLabel: OPENROUTER_CLI_LABEL,
        baseUrl: OPENROUTER_API_BASE_URL,
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
        model: typeof parsed.model === "string" ? parsed.model : DEFAULT_BYOK_CONFIG.model,
      })
    } catch {
      window.localStorage.removeItem(BYOK_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (hasResearchSession) return
    window.localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(byokConfig))
  }, [byokConfig, hasResearchSession])

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop()
      speechRecognitionRef.current?.abort()
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  useEffect(() => {
    const runIds = uniqueIds(initialRunIds)
    const consolidationRunId = initialConsolidationRunId?.trim() || null
    if (runIds.length === 0 && !consolidationRunId) return

    let cancelled = false
    async function hydrateRunsFromUrl() {
      const [nextRuns, nextConsolidationRun] = await Promise.all([
        Promise.all(runIds.map(fetchRunState)),
        consolidationRunId ? fetchRunState(consolidationRunId) : Promise.resolve(null),
      ])

      if (cancelled) return
      const restoredRuns = nextRuns.filter((run): run is ResearchRunState => Boolean(run))
      const firstRun = restoredRuns[0] ?? nextConsolidationRun

      if (restoredRuns.length > 0) setRuns(restoredRuns)
      if (nextConsolidationRun) setConsolidationRun(nextConsolidationRun)
      if (firstRun) setFocusedRunId(firstRun.runId)
      if (firstRun) {
        setQuery(firstRun.query)
        setMethodId(normalizeResearchMethodId(firstRun.methodId))
        setSelectedCliIds(uniqueCliIds(restoredRuns.length > 0 ? restoredRuns.map((run) => run.cliId) : [firstRun.cliId]))
      }

      const missingCount = runIds.length - restoredRuns.length + (consolidationRunId && !nextConsolidationRun ? 1 : 0)
      setError(missingCount > 0 ? `${missingCount} execução(ões) da URL não foram encontradas.` : null)
    }

    void hydrateRunsFromUrl()
    return () => {
      cancelled = true
    }
  }, [initialConsolidationRunId, initialRunIdsKey])

  useEffect(() => {
    const visibleRuns = consolidationRun ? [...runs, consolidationRun] : runs
    if (visibleRuns.length === 0) {
      if (focusedRunId !== null) setFocusedRunId(null)
      return
    }
    if (focusedRunId && visibleRuns.some((run) => run.runId === focusedRunId)) return
    setFocusedRunId(visibleRuns[0]?.runId ?? null)
  }, [consolidationRun, focusedRunId, runs])

  useEffect(() => {
    const activeRunIds = activeStreamRunIdsKey.split(",").filter(Boolean)
    if (activeRunIds.length === 0) return

    const sources = activeRunIds.map((runId) => {
      const source = new EventSource(`/api/research/runs/${encodeURIComponent(runId)}/stream`)
      source.onmessage = (message) => {
        try {
          applyRunState(JSON.parse(message.data) as ResearchRunState)
        } catch {
          void refreshRun(runId)
        }
      }
      source.onerror = () => {
        source.close()
        void refreshRun(runId)
      }
      return source
    })

    return () => {
      sources.forEach((source) => source.close())
    }
  }, [activeStreamRunIdsKey])

  async function ensureAudioAttachment() {
    if (!audioFile) return audioAttachment
    return uploadAudioAttachment(audioFile, false)
  }

  async function uploadAudioAttachment(file: File, transcribe: boolean) {
    setIsUploadingAttachment(true)
    if (transcribe) setIsTranscribingAudio(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("slug", researchOutputSlug)
      if (transcribe) formData.append("transcribe", "true")
      const response = await fetch("/api/research/uploads/audio", {
        method: "POST",
        body: formData,
      })
      const body = (await response.json()) as ResearchAttachmentResult | { error?: string }
      if (!response.ok || "error" in body) {
        throw new Error("error" in body && body.error ? body.error : "Falha ao anexar áudio.")
      }
      const uploaded = body as ResearchAttachmentResult
      setAudioAttachment(uploaded)
      setAudioFile(null)
      if (uploaded.transcript?.trim()) appendTranscriptToQuery(uploaded.transcript)
      if (transcribe && !uploaded.transcript?.trim() && uploaded.transcriptionMessage) {
        setError(uploaded.transcriptionMessage)
      }
      return uploaded
    } finally {
      setIsUploadingAttachment(false)
      setIsTranscribingAudio(false)
    }
  }

  async function ensureContextAttachments() {
    if (contextFiles.length === 0) return contextAttachments
    setIsUploadingAttachment(true)
    const formData = new FormData()
    contextFiles.forEach((file) => formData.append("files", file))
    formData.append("slug", researchOutputSlug)
    const response = await fetch("/api/research/uploads/files", {
      method: "POST",
      body: formData,
    })
    const body = (await response.json()) as { uploaded?: ResearchAttachmentResult[]; failed?: string[]; error?: string }
    if (!response.ok || body.error) {
      throw new Error(body.error || "Falha ao anexar arquivos.")
    }
    const uploaded = body.uploaded ?? []
    if (uploaded.length === 0 && contextFiles.length > 0) {
      throw new Error("Nenhum arquivo foi anexado.")
    }
    const nextAttachments = [...contextAttachments, ...uploaded]
    setContextAttachments(nextAttachments)
    setContextFiles([])
    if (body.failed && body.failed.length > 0) {
      setError(`Alguns anexos falharam: ${body.failed.join(", ")}`)
    }
    return nextAttachments
  }

  function buildRequestQuery(audio: ResearchAttachmentResult | null, files: ResearchAttachmentResult[]) {
    const trimmedQuery = query.trim()
    if (!audio && files.length === 0) return trimmedQuery
    const lines = [trimmedQuery || "Pesquise o conteúdo dos anexos."]
    if (audio) {
      const transcript = audio.transcript?.trim()
      lines.push(
        "",
        `Áudio anexado: ${audio.path} (${audio.name}, ${formatBytes(audio.size)}).`,
        "Use esse arquivo como entrada da pesquisa; transcreva, sumarize e extraia evidências quando o runtime suportar leitura de áudio local.",
      )
      if (transcript && !trimmedQuery.includes(transcript)) {
        lines.push("", "Transcrição do áudio:", transcript)
      }
    }
    if (files.length > 0) {
      lines.push(
        "",
        "Arquivos anexados como contexto:",
        ...files.map((file) => `- ${file.path} (${file.name}, ${file.type || "tipo desconhecido"}, ${formatBytes(file.size)})`),
        "Leia os arquivos acima antes de pesquisar e trate-os como contexto fornecido pelo usuário. Cite quando uma conclusão vier de um anexo.",
      )
    }
    return lines.join("\n")
  }

  async function startRuns() {
    setIsStarting(true)
    setError(null)
    setRuns([])
    setConsolidationRun(null)
    try {
      const uploadedAudio = await ensureAudioAttachment()
      const uploadedFiles = await ensureContextAttachments()
      const requestQuery = buildRequestQuery(uploadedAudio, uploadedFiles)
      const runnableIds = new Set(runnableSelectedClis.map((cli) => cli.id))
      const requests =
        executionMode === "byok"
          ? [
              normalizeResearchRunRequest({
                query: requestQuery,
                cliId: "byok",
                methodId,
                depth,
                outputSlug: researchOutputSlug,
                byok: byokConfig,
              }),
            ]
          : selectedCliIds
              .filter((cliId) => runnableIds.has(cliId))
              .map((cliId) =>
                normalizeResearchRunRequest({
                  query: requestQuery,
                  cliId,
                  methodId,
                  depth,
                  outputSlug: researchOutputSlug,
                }),
              )
      const results = await Promise.allSettled(
        requests.map(async (request) => {
          const response = await fetch("/api/research/runs", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(request),
          })
          const body = (await response.json()) as ResearchRunState | { error?: string }
          if (!response.ok || "error" in body) {
            throw new Error("error" in body && body.error ? body.error : `Falha ao iniciar ${request.cliId}.`)
          }
          return body as ResearchRunState
        }),
      )
      const successfulRuns = results
        .filter((result): result is PromiseFulfilledResult<ResearchRunState> => result.status === "fulfilled")
        .map((result) => result.value)
      const failedMessages = results
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason instanceof Error ? result.reason.message : "Falha ao iniciar uma pesquisa.")

      if (successfulRuns.length === 0) {
        throw new Error(failedMessages[0] ?? "Falha ao iniciar pesquisas.")
      }
      setRuns(successfulRuns)
      setMethodId(normalizeResearchMethodId(successfulRuns[0]?.methodId ?? methodId))
      setFocusedRunId(successfulRuns[0]?.runId ?? null)
      syncResearchUrl(successfulRuns, null)
      if (failedMessages.length > 0) setError(failedMessages.join(" "))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao iniciar pesquisas.")
    } finally {
      setIsUploadingAttachment(false)
      setIsTranscribingAudio(false)
      setIsStarting(false)
    }
  }

  async function startConsolidationRun() {
    const consolidationCli = runnableSelectedClis[0] ?? discovery.clis.find((cli) => cli.available && cli.launchSupported)
    if (!consolidationCli) {
      setError("Nenhum CLI disponível para consolidar.")
      return
    }

    setIsConsolidating(true)
    setError(null)
    try {
      const response = await fetch("/api/research/consolidations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          cliId: consolidationCli.id,
          methodId,
          depth,
          sourceOutputSlugs: uniqueIds(completedRuns.map((run) => run.outputSlug)),
          sourceCliIds: completedRuns.map((run) => run.cliId),
          outputSlug: completedRuns[0]?.outputSlug ?? researchOutputSlug,
        }),
      })
      const body = (await response.json()) as ResearchRunState | { error?: string }
      if (!response.ok || "error" in body) {
        throw new Error("error" in body && body.error ? body.error : "Falha ao iniciar consolidação.")
      }
      const nextConsolidationRun = body as ResearchRunState
      setConsolidationRun(nextConsolidationRun)
      setFocusedRunId(nextConsolidationRun.runId)
      syncResearchUrl(runs, nextConsolidationRun)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao iniciar consolidação.")
    } finally {
      setIsConsolidating(false)
    }
  }

  async function refreshRun(runId: string) {
    const response = await fetch(`/api/research/runs/${encodeURIComponent(runId)}`, { cache: "no-store" })
    if (!response.ok) return
    const next = (await response.json()) as ResearchRunState
    applyRunState(next)
  }

  async function retryRun(run: ResearchRunState) {
    if (run.status !== "failed" || retryingRunIds.includes(run.runId)) return
    setRetryingRunIds((current) => [...current, run.runId])
    setError(null)
    try {
      const response = await fetch("/api/research/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: run.query,
          cliId: run.cliId,
          methodId: normalizeResearchMethodId(run.methodId),
          depth,
          outputSlug: run.outputSlug,
          byok: run.cliId === "byok" ? byokConfig : undefined,
        }),
      })
      const body = (await response.json()) as ResearchRunState | { error?: string }
      if (!response.ok || "error" in body) {
        throw new Error("error" in body && body.error ? body.error : `Falha ao reiniciar ${cliLabel(run.cliId)}.`)
      }

      const nextRun = body as ResearchRunState
      let nextRunsSnapshot: ResearchRunState[] | null = null
      setRuns((current) => {
        const nextRuns = current.map((item) => (item.runId === run.runId ? nextRun : item))
        nextRunsSnapshot = nextRuns
        return nextRuns
      })
      setConsolidationRun((current) => (current?.runId === run.runId ? nextRun : current))
      setFocusedRunId(nextRun.runId)
      syncResearchUrl(nextRunsSnapshot ?? runs.map((item) => (item.runId === run.runId ? nextRun : item)), consolidationRun?.runId === run.runId ? nextRun : consolidationRun)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Falha ao reiniciar ${cliLabel(run.cliId)}.`)
    } finally {
      setRetryingRunIds((current) => current.filter((runId) => runId !== run.runId))
    }
  }

  function applyRunState(next: ResearchRunState) {
    setRuns((current) => current.map((run) => (run.runId === next.runId ? next : run)))
    setConsolidationRun((current) => (current?.runId === next.runId ? next : current))
  }

  function submitResearch() {
    if (hasResearchSession || !canStart || isStarting) return
    void startRuns()
  }

  function syncResearchUrl(nextRuns: ResearchRunState[], nextConsolidationRun: ResearchRunState | null) {
    const params = new URLSearchParams()
    if (nextRuns.length > 0) params.set("runs", nextRuns.map((run) => run.runId).join(","))
    if (nextConsolidationRun) params.set("consolidation", nextConsolidationRun.runId)
    const queryString = params.toString()
    router.replace(queryString ? `/research?${queryString}` : "/research", { scroll: false })
  }

  function toggleCli(cliId: ResearchCliId) {
    setSelectedCliIds((current) => {
      if (current.includes(cliId)) {
        return current.length === 1 ? current : current.filter((selectedCliId) => selectedCliId !== cliId)
      }
      return [...current, cliId]
    })
  }

  function selectAllRunnableClis() {
    const runnableIds = discovery.clis
      .filter((cli) => cli.available && cli.launchSupported)
      .map((cli) => cli.id)
    if (runnableIds.length > 0) setSelectedCliIds(runnableIds)
  }

  function setExecutionModeFromPicker(mode: ResearchExecutionMode) {
    setExecutionMode(mode)
    if (mode === "byok") {
      setByokConfig((current) => ({
        ...current,
        providerLabel: OPENROUTER_CLI_LABEL,
        baseUrl: OPENROUTER_API_BASE_URL,
      }))
    }
  }

  function updateByokConfig(patch: Partial<ResearchByokConfig>) {
    setByokConfig((current) => ({
      ...current,
      ...patch,
      providerLabel: OPENROUTER_CLI_LABEL,
      baseUrl: OPENROUTER_API_BASE_URL,
    }))
  }

  function toggleComposerCli(cliId: ResearchCliId) {
    setExecutionMode("local")
    toggleCli(cliId)
  }

  function appendTranscriptToQuery(transcript: string) {
    const normalized = transcript.trim().replace(/\s+/g, " ")
    if (!normalized) return
    setQuery((current) => {
      if (current.includes(normalized)) return current
      const prefix = current.trim()
      return prefix ? `${prefix}\n\nTranscrição do áudio:\n${normalized}` : normalized
    })
  }

  function handleAudioButtonClick() {
    if (isRecordingAudio) {
      stopAudioRecording()
      return
    }
    void startAudioRecording()
  }

  async function startAudioRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Gravação de áudio não disponível neste navegador. Use o anexo de arquivo para enviar um áudio.")
      audioInputRef.current?.click()
      return
    }

    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaStreamRef.current = stream
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      speechTranscriptRef.current = ""

      const recognition = createSpeechRecognition()
      if (recognition) {
        recognition.onresult = (event) => {
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index]
            const alternative = result?.[0]
            if (result?.isFinal && alternative?.transcript) {
              speechTranscriptRef.current = `${speechTranscriptRef.current} ${alternative.transcript}`.trim()
            }
          }
        }
        recognition.onerror = () => undefined
        speechRecognitionRef.current = recognition
        try {
          recognition.start()
        } catch {
          speechRecognitionRef.current = null
        }
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm"
        const chunks = audioChunksRef.current
        const recordedFile = new File(chunks, `audio-pesquisa-${Date.now()}.${audioExtensionFromMimeType(mimeType)}`, { type: mimeType })
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        try {
          speechRecognitionRef.current?.stop()
        } catch {
          speechRecognitionRef.current?.abort()
        }
        speechRecognitionRef.current = null
        setIsRecordingAudio(false)
        void acceptAudioFile(recordedFile, speechTranscriptRef.current)
      }
      recorder.start()
      setIsRecordingAudio(true)
    } catch (caught) {
      setIsRecordingAudio(false)
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
      setError(caught instanceof Error ? caught.message : "Não foi possível iniciar a gravação.")
    }
  }

  function stopAudioRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === "inactive") {
      setIsRecordingAudio(false)
      return
    }
    recorder.stop()
  }

  async function acceptAudioFile(file: File, browserTranscript = "") {
    if (file.size <= 0) return
    setAudioFile(file)
    setAudioAttachment(null)
    const transcript = browserTranscript.trim()
    if (transcript) appendTranscriptToQuery(transcript)
    try {
      await uploadAudioAttachment(file, !transcript)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao anexar ou transcrever áudio.")
    }
  }

  function handleAudioFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null
    if (!nextFile) return
    void acceptAudioFile(nextFile)
    event.target.value = ""
  }

  function addContextFiles(files: File[]) {
    const nextFiles = files.filter((file) => file.size > 0)
    if (nextFiles.length === 0) return
    setContextFiles((current) => [...current, ...nextFiles])
  }

  function handleContextFileChange(event: ChangeEvent<HTMLInputElement>) {
    addContextFiles(Array.from(event.target.files ?? []))
    event.target.value = ""
  }

  function handlePromptPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files ?? [])
    if (files.length === 0) return
    event.preventDefault()
    addContextFiles(files)
  }

  function handleComposerDragOver(event: DragEvent<HTMLDivElement>) {
    if (hasResearchSession || !Array.from(event.dataTransfer.types).includes("Files")) return
    event.preventDefault()
    setIsComposerDragActive(true)
  }

  function handleComposerDrop(event: DragEvent<HTMLDivElement>) {
    if (hasResearchSession) return
    event.preventDefault()
    setIsComposerDragActive(false)
    addContextFiles(Array.from(event.dataTransfer.files ?? []))
  }

  function clearAudioAttachment() {
    setAudioFile(null)
    setAudioAttachment(null)
  }

  function removePendingContextFile(indexToRemove: number) {
    setContextFiles((current) => current.filter((_, index) => index !== indexToRemove))
  }

  function removeContextAttachment(pathToRemove: string) {
    setContextAttachments((current) => current.filter((attachment) => attachment.path !== pathToRemove))
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return
    event.preventDefault()
    submitResearch()
  }

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[var(--paper)] text-[var(--ink)]"
      style={{ ...AIOX_RESEARCH_THEME, fontFamily: SANS_FONT }}
    >
      <section className="relative min-h-screen border-b border-[var(--rule)]">
        <div className="pointer-events-none absolute inset-0 grid grid-cols-4">
          <span className="border-l border-[var(--grid-line)]" />
          <span className="border-l border-[var(--grid-line)]" />
          <span className="border-l border-[var(--grid-line)]" />
          <span className="border-x border-[var(--grid-line)]" />
        </div>
        {hasResearchSession ? (
          <div
            className="pointer-events-none absolute left-1/2 top-[23%] hidden -translate-x-1/2 select-none text-center text-[22vw] font-black uppercase leading-none text-[rgba(245,244,231,0.045)] lg:block"
            style={{ fontFamily: DISPLAY_FONT }}
          >
            AIOX
          </div>
        ) : null}

        <div
          className={cn(
            "relative z-10 mx-auto flex w-full flex-col px-4 sm:px-5 md:px-8",
            "max-w-[1280px]",
            hasResearchSession
              ? "min-h-0 py-6 lg:py-10"
              : "min-h-0 py-10 lg:py-16",
          )}
        >
          <div
            className={cn(
              "mx-auto flex w-full flex-col items-center text-center",
              hasResearchSession ? "max-w-[1280px]" : "max-w-[800px]",
              hasResearchSession ? "justify-start" : "justify-start",
            )}
          >
            <h1
              className={cn(
                "font-black uppercase leading-none tracking-normal text-[var(--ink)]",
                hasResearchSession
                  ? "max-w-[820px] text-[34px] sm:text-[44px] lg:text-[54px]"
                  : "max-w-none text-[20px]",
              )}
              style={{ fontFamily: DISPLAY_FONT }}
            >
              {hasResearchSession ? (
                <>
                  Pesquisa em <span className="text-[var(--lime-ink)]">{sessionHeadline(runs, consolidationRun)}</span>
                </>
              ) : (
                <span className="inline-flex flex-wrap items-center justify-center gap-3 normal-case sm:gap-4">
                  <img src="/logo/AIOX-White.svg" alt="AIOX" className="h-5 w-auto shrink-0 sm:h-6" />
                  <span className="my-1 h-3.5 w-px self-stretch bg-[var(--rule-strong)] sm:h-4" />
                  <span className="font-black uppercase tracking-normal" style={{ fontFamily: DISPLAY_FONT }}>
                    Research
                  </span>
                </span>
              )}
            </h1>

            <div
              className={cn(
                "relative w-full border border-[var(--rule)] bg-[var(--surface)] text-left shadow-[0_28px_90px_rgba(0,0,0,0.28)]",
                hasResearchSession ? "mt-6 sm:mt-7" : "mt-6 sm:mt-10",
                !hasResearchSession && "mb-7 sm:mb-8",
                isComposerDragActive && "border-[var(--lime-ink)]",
              )}
              onDragOver={handleComposerDragOver}
              onDragLeave={() => setIsComposerDragActive(false)}
              onDrop={handleComposerDrop}
            >
              {!hasResearchSession ? (
                <>
                  <span className="pointer-events-none absolute -left-px -top-px h-[14px] w-[14px] border-l border-t border-[var(--lime-ink)] shadow-[0_0_14px_rgba(209,255,0,0.10)]" />
                  <span className="pointer-events-none absolute -right-px -top-px h-[14px] w-[14px] border-r border-t border-[var(--lime-ink)] shadow-[0_0_14px_rgba(209,255,0,0.10)]" />
                  <span className="pointer-events-none absolute -bottom-px -left-px h-[14px] w-[14px] border-b border-l border-[var(--lime-ink)] shadow-[0_0_14px_rgba(209,255,0,0.10)]" />
                  <span className="pointer-events-none absolute -bottom-px -right-px h-[14px] w-[14px] border-b border-r border-[var(--lime-ink)] shadow-[0_0_14px_rgba(209,255,0,0.10)]" />
                </>
              ) : null}
              {hasResearchSession ? (
                <div className="grid border-b border-[var(--rule)] bg-[var(--paper-deep)] sm:grid-cols-[1fr_auto]">
                  <div className="flex min-h-12 items-center gap-3 border-b border-[var(--rule)] px-4 sm:border-b-0 sm:border-r">
                    <Search size={16} className="text-[var(--lime-ink)]" />
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-3)]"
                      style={{ fontFamily: MONO_FONT }}
                    >
                      Research Prompt
                    </span>
                  </div>
                  <div
                    className="flex min-h-12 items-center px-4 text-[10px] uppercase tracking-[0.12em] text-[var(--ink-2)]"
                    style={{ fontFamily: MONO_FONT }}
                  >
                    {researchMethodLabel(sessionMethodId)} · {researchDepthLabel(depth)}
                  </div>
                </div>
              ) : null}

              {hasResearchSession ? (
                <SessionPromptSummary
                  query={query}
                  runs={runs}
                  consolidationRun={consolidationRun}
                  methodId={sessionMethodId}
                  depth={depth}
                />
              ) : (
                <>
                  <textarea
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={handlePromptKeyDown}
                    onPaste={handlePromptPaste}
                    placeholder="Pesquise um mercado, uma tecnologia, um concorrente, uma tese ou um conjunto de fontes..."
                    className="min-h-[132px] w-full resize-none border-0 bg-[var(--paper-deep)] px-5 py-5 text-[15px] leading-[1.55] text-[var(--ink)] outline-none placeholder:text-[var(--ink-dim)] focus:bg-[var(--surface-console)] sm:min-h-[220px] sm:px-[26px] sm:py-[22px] sm:text-[17px]"
                  />

                  <div className="flex min-h-[52px] flex-col items-stretch border-t border-[var(--rule-soft)] bg-[var(--surface)] xl:flex-row xl:flex-wrap">
                    <div className="flex min-w-0 flex-wrap items-stretch xl:flex-1">
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleAudioFileChange}
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleContextFileChange}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          "grid h-[52px] w-14 shrink-0 place-items-center border-r border-[var(--rule-soft)] text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]",
                          (contextFiles.length > 0 || contextAttachments.length > 0) && "bg-[var(--surface-hover)] text-[var(--lime-ink)]",
                        )}
                        aria-label="Anexar arquivos"
                      >
                        <Plus size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={handleAudioButtonClick}
                        className={cn(
                          "grid h-[52px] w-14 shrink-0 place-items-center border-r border-[var(--rule-soft)] text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]",
                          (audioFile || audioAttachment) && "text-[var(--lime-ink)]",
                          isRecordingAudio && "bg-[rgba(239,68,68,0.12)] text-[var(--danger-ink)]",
                        )}
                        aria-label={isRecordingAudio ? "Parar gravação" : "Gravar áudio"}
                      >
                        {isTranscribingAudio ? <Loader2 size={15} className="animate-spin" /> : isRecordingAudio ? <Square size={13} fill="currentColor" /> : <Mic size={15} />}
                      </button>
                      <ResearchMethodPicker
                        methodId={methodId}
                        open={methodPickerOpen}
                        onOpenChange={setMethodPickerOpen}
                        onChange={(nextMethodId) => {
                          setMethodId(nextMethodId)
                          setMethodPickerOpen(false)
                        }}
                      />
                      {audioFile || audioAttachment ? (
                        <button
                          type="button"
                          onClick={clearAudioAttachment}
                          className="inline-flex h-[52px] min-w-0 max-w-[240px] items-center gap-2 border-r border-[var(--rule-soft)] bg-[var(--paper-deep)] px-4 text-[11px] text-[var(--ink-2)] transition-colors hover:text-[var(--danger-ink)]"
                          aria-label={`${audioFile?.name ?? audioAttachment?.name} · remover`}
                        >
                          <span className="truncate">{isTranscribingAudio ? "Transcrevendo áudio..." : audioFile?.name ?? audioAttachment?.name}</span>
                          <X size={13} className="shrink-0" />
                        </button>
                      ) : null}
                      {contextFiles.map((file, index) => (
                        <button
                          key={`pending-${file.name}-${file.size}-${index}`}
                          type="button"
                          onClick={() => removePendingContextFile(index)}
                          className="inline-flex h-[52px] min-w-0 max-w-[240px] items-center gap-2 border-r border-[var(--rule-soft)] bg-[var(--paper-deep)] px-4 text-[11px] text-[var(--ink-2)] transition-colors hover:text-[var(--danger-ink)]"
                          aria-label={`${file.name} · remover`}
                        >
                          <span className="truncate">{file.name}</span>
                          <X size={13} className="shrink-0" />
                        </button>
                      ))}
                      {contextAttachments.map((attachment) => (
                        <button
                          key={attachment.path}
                          type="button"
                          onClick={() => removeContextAttachment(attachment.path)}
                          className="inline-flex h-[52px] min-w-0 max-w-[240px] items-center gap-2 border-r border-[var(--rule-soft)] bg-[var(--paper-deep)] px-4 text-[11px] text-[var(--ink-2)] transition-colors hover:text-[var(--danger-ink)]"
                          aria-label={`${attachment.name} · remover`}
                        >
                          <span className="truncate">{attachment.name}</span>
                          <X size={13} className="shrink-0" />
                        </button>
                      ))}
                    </div>

                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.04fr)] items-stretch border-t border-[var(--rule-soft)] xl:ml-auto xl:flex xl:shrink-0 xl:border-t-0">
                      <ComposerModelPicker
                        clis={discovery.clis}
                        selectedCliIds={selectedCliIds}
                        mode={executionMode}
                        byokConfig={byokConfig}
                        open={modelPickerOpen}
                        onOpenChange={setModelPickerOpen}
                        onToggleCli={toggleComposerCli}
                        onSelectAll={selectAllRunnableClis}
                        onModeChange={setExecutionModeFromPicker}
                        onByokConfigChange={updateByokConfig}
                      />
                      <button
                        type="button"
                        onClick={submitResearch}
                        disabled={!canStart || isStarting || isUploadingAttachment}
                        className={cn(
                          "inline-flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2.5 px-4 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors sm:flex-none sm:gap-3 sm:px-6 sm:text-[12px] sm:tracking-[0.16em] xl:min-w-[164px]",
                          canStart && !isUploadingAttachment
                            ? "bg-[var(--lime-ink)] text-black hover:brightness-105"
                            : "cursor-not-allowed bg-[var(--lime-ink)] text-black brightness-75",
                        )}
                        style={{ fontFamily: MONO_FONT }}
                        aria-label={isTranscribingAudio ? "Transcrevendo" : isUploadingAttachment ? "Anexando" : "Pesquisar"}
                      >
                        {isStarting || isUploadingAttachment ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <>
                            <span>Pesquisar</span>
                            <ArrowRight size={15} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {!hasResearchSession ? (
              <QuickSuggestionRow
                onSelect={(suggestion) => {
                  setQuery(suggestion.prompt)
                  setMethodId(suggestion.methodId)
                  setMethodPickerOpen(false)
                  setError(null)
                }}
              />
            ) : null}

            {error && (
              <p className="mt-4 flex max-w-[1880px] gap-2 text-left text-[13px] leading-[1.45] text-[var(--danger-ink)]">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

          </div>

          <div className={cn("mx-auto w-full", hasResearchSession ? "mt-10 max-w-[1280px]" : "mt-0 max-w-[800px]")}>
            {runs.length > 0 || consolidationRun ? (
              <BatchStatus
                runs={runs}
                consolidationRun={consolidationRun}
                focusedRunId={focusedRunId}
                canConsolidate={canConsolidate}
                isConsolidating={isConsolidating}
                onConsolidate={() => void startConsolidationRun()}
                retryingRunIds={retryingRunIds}
                onRetryRun={(run) => void retryRun(run)}
                onFocus={setFocusedRunId}
                onOpen={(run) => router.push(`/observatory/research?slug=${encodeURIComponent(run.outputSlug)}`)}
              />
            ) : hasUrlScopedSession ? (
              <ExecutionEmptyState
                icon={<RefreshCcw className="mx-auto mb-3 animate-spin text-[var(--lime-ink)]" size={22} />}
                title="Restaurando execução"
                body="Buscando o estado salvo dos runs informados nesta URL."
              />
            ) : null}
            <RecentResearchList
              runs={recentRuns}
              flushTop={!hasResearchSession}
              onOpenDash={() => router.push("/observatory")}
              onOpenRun={(slug) => router.push(`/observatory/research?slug=${encodeURIComponent(slug)}`)}
            />
          </div>
        </div>
      </section>

      <footer
        className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[10px] uppercase tracking-[0.18em] text-[var(--ink-dim)] sm:px-5 md:px-8"
        style={{ fontFamily: MONO_FONT }}
      >
        <span className="text-[var(--ink-2)]">AIOX Pro</span>
        <span className="flex items-center gap-3">
          <span>Detector · {discovery.clis.filter((cli) => cli.available && cli.launchSupported).length} CLIs prontos</span>
          <span className="border border-[var(--rule)] px-2 py-1 text-[var(--ink-2)]">v0.1.0</span>
        </span>
      </footer>
    </main>
  )
}

function ResearchMethodPicker({
  methodId,
  open,
  onOpenChange,
  onChange,
}: {
  methodId: ResearchMethodId
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (methodId: ResearchMethodId) => void
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const selectedMethod = methodById(methodId)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) onOpenChange(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [onOpenChange, open])

  return (
    <div className="relative min-w-[152px] flex-1 xl:min-w-[176px] xl:flex-none" ref={wrapRef}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          "group relative inline-flex h-[52px] w-full min-w-0 items-center gap-3 border-r border-[var(--rule-soft)] px-4 text-[12px] font-semibold transition-colors xl:min-w-[204px] xl:px-[18px]",
          open
            ? "bg-[var(--surface-hover)] text-[var(--ink)]"
            : "bg-[var(--paper-deep)] text-[var(--ink-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]",
        )}
        aria-expanded={open}
        aria-label="Selecionar tipo de pesquisa"
      >
        <span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-dim)] sm:inline" style={{ fontFamily: MONO_FONT }}>
          Tipo
        </span>
        <span className="truncate text-[13.5px] font-medium text-[var(--ink)]">
          {methodDisplayName(selectedMethod.label)}
        </span>
        <ChevronDown size={13} className={cn("ml-auto shrink-0 transition-transform text-[var(--ink-dim)]", open && "rotate-180 text-[var(--lime-ink)]")} />
        <OptionTooltip title={selectedMethod.label} body={researchMethodTooltip(selectedMethod)} />
      </button>

      {open ? (
        <div
          className="absolute bottom-[calc(100%+6px)] left-0 z-50 w-[min(320px,calc(100vw-2rem))] border border-[var(--rule)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(0,0,0,0.62)]"
          role="listbox"
        >
          {RESEARCH_METHODS.map((method, index) => {
            const active = method.id === methodId
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => onChange(method.id)}
                role="option"
                aria-selected={active}
                className={cn(
                  "group relative grid min-h-12 w-full grid-cols-[10px_minmax(0,1fr)_28px] items-center gap-3 border-b border-[var(--rule)] px-4 text-left transition-colors last:border-b-0",
                  active
                    ? "bg-[var(--surface-hover)] text-[var(--lime-ink)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]",
                )}
              >
                <span className={cn("h-1.5 w-1.5 border border-current", active && "bg-[var(--lime-ink)] shadow-[0_0_8px_rgba(209,255,0,0.8)]")} />
                <span className="truncate text-[13px] font-semibold">{methodDisplayName(method.label)}</span>
                <span className="text-right text-[10px] tracking-[0.12em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <OptionTooltip title={method.label} body={researchMethodTooltip(method)} />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function QuickSuggestionRow({ onSelect }: { onSelect: (suggestion: (typeof QUICK_RESEARCH_SUGGESTIONS)[number]) => void }) {
  return (
    <div className="mb-9 mt-4 grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 text-left sm:mb-20 sm:flex sm:flex-wrap sm:gap-x-1.5 sm:gap-y-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.20em] text-[var(--ink-dim)] sm:mr-2" style={{ fontFamily: MONO_FONT }}>
        Sugestões
      </span>
      <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {QUICK_RESEARCH_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            onClick={() => onSelect(suggestion)}
            className="inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap border border-[var(--rule)] bg-transparent px-3 text-[13px] font-medium text-[var(--ink-2)] transition-colors hover:border-[var(--rule-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
          >
            <span className="text-[var(--lime-ink)]" style={{ fontFamily: MONO_FONT }}>
              ›
            </span>
            {suggestion.label}
            <span className="border-l border-[var(--rule)] pl-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
              {methodDisplayName(researchMethodLabel(suggestion.methodId))}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function OptionTooltip({ title, body }: { title: string; body: string }) {
  return (
    <span
      className="pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-[70] w-[min(300px,calc(100vw-2rem))] -translate-x-1/2 border border-[var(--rule-strong)] bg-[var(--surface-console)] px-3 py-3 text-left normal-case tracking-normal text-[var(--ink-2)] opacity-0 shadow-[0_18px_44px_rgba(0,0,0,0.52)] transition-opacity delay-0 duration-150 group-hover:delay-1000 group-hover:opacity-100 group-focus-visible:delay-1000 group-focus-visible:opacity-100"
      role="tooltip"
      aria-hidden="true"
    >
      <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--lime-ink)]" style={{ fontFamily: MONO_FONT }}>
        {title}
      </span>
      <span className="mt-1 block text-[12px] font-normal leading-[1.45] text-[var(--ink-2)]" style={{ fontFamily: SANS_FONT }}>
        {body}
      </span>
    </span>
  )
}

function ComposerModelPicker({
  clis,
  selectedCliIds,
  mode,
  byokConfig,
  open,
  onOpenChange,
  onToggleCli,
  onSelectAll,
  onModeChange,
  onByokConfigChange,
}: {
  clis: ResearchCliStatus[]
  selectedCliIds: ResearchCliId[]
  mode: ResearchExecutionMode
  byokConfig: ResearchByokConfig
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleCli: (cliId: ResearchCliId) => void
  onSelectAll: () => void
  onModeChange: (mode: ResearchExecutionMode) => void
  onByokConfigChange: (patch: Partial<ResearchByokConfig>) => void
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | undefined>(undefined)
  const availableClis = clis.filter((cli) => cli.available && cli.launchSupported)
  const selectedAvailableClis = availableClis.filter((cli) => selectedCliIds.includes(cli.id))
  const selectedLabel =
    mode === "byok"
      ? byokConfig.model || OPENROUTER_CLI_LABEL
      : selectedAvailableClis.length === 0
        ? "CLI"
        : selectedAvailableClis.length === 1
          ? compactCliLabel(selectedAvailableClis[0].id)
          : `${selectedAvailableClis.length} CLIs`
  const byokReady = Boolean(byokConfig.apiKey && byokConfig.baseUrl && byokConfig.model)

  useEffect(() => {
    if (!open) return
    const updatePosition = () => {
      if (!wrapRef.current) return
      const rect = wrapRef.current.getBoundingClientRect()
      const viewportPad = 16
      const width = Math.min(380, window.innerWidth - viewportPad * 2)
      setPopoverStyle({
        width,
        left: Math.min(Math.max(viewportPad, rect.right - width), window.innerWidth - width - viewportPad),
        bottom: Math.max(viewportPad, window.innerHeight - rect.top + 10),
      })
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) onOpenChange(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false)
    }
    updatePosition()
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [onOpenChange, open])

  return (
    <div className="relative min-w-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          "relative inline-flex h-[52px] w-full min-w-0 items-center gap-2.5 border-l border-[var(--rule-soft)] border-r border-[var(--rule-soft)] bg-[var(--paper-deep)] px-3 text-[12px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-hover)] sm:gap-3 sm:px-[18px] xl:max-w-[204px]",
          open
            ? "bg-[var(--surface-hover)]"
            : "",
        )}
        aria-expanded={open}
        aria-label="Selecionar modelo"
      >
        <span className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-0.5 bg-[var(--lime-ink)] shadow-[0_0_14px_rgba(209,255,0,0.25)]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
          {mode === "byok" ? "OpenRouter" : "CLI"}
        </span>
        <span className="truncate text-[13.5px] font-medium normal-case tracking-normal" style={{ fontFamily: SANS_FONT }}>{selectedLabel}</span>
        <ChevronDown size={13} className={cn("ml-auto shrink-0 text-[var(--ink-dim)] transition-transform", open && "rotate-180 text-[var(--lime-ink)]")} />
      </button>

      {open && (
        <div
          className="fixed z-50 border border-[var(--rule-strong)] bg-[var(--surface)] text-left shadow-[0_24px_70px_rgba(0,0,0,0.62)]"
          style={popoverStyle}
        >
          <span className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b border-r border-[var(--lime-ink)]" />
          <div className="grid grid-cols-2 border-b border-[var(--rule)]">
            <button
              type="button"
              onClick={() => onModeChange("local")}
              className={cn(
                "relative h-10 border-r border-[var(--rule)] text-[10px] font-bold uppercase tracking-[0.18em] transition-colors",
                mode === "local"
                  ? "bg-[var(--surface-hover)] text-[var(--lime-ink)] shadow-[inset_0_-1px_0_var(--lime-ink)]"
                  : "bg-[var(--paper-deep)] text-[var(--ink-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]",
              )}
              style={{ fontFamily: MONO_FONT }}
            >
              Local CLI
            </button>
            <button
              type="button"
              onClick={() => onModeChange("byok")}
              className={cn(
                "h-10 text-[10px] font-bold uppercase tracking-[0.18em] transition-colors",
                mode === "byok"
                  ? "bg-[var(--surface-hover)] text-[var(--lime-ink)] shadow-[inset_0_-1px_0_var(--lime-ink)]"
                  : "bg-[var(--paper-deep)] text-[var(--ink-3)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]",
              )}
              style={{ fontFamily: MONO_FONT }}
            >
              OpenRouter
            </button>
          </div>

          {mode === "local" ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-[var(--rule)] px-4 py-3">
                <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
                  <span className="font-bold text-[var(--lime-ink)]">[{String(availableClis.length).padStart(2, "0")}]</span>
                  <span className="ml-2">CLIs em paralelo</span>
                </span>
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-3)] transition-colors hover:text-[var(--lime-ink)]"
                  style={{ fontFamily: MONO_FONT }}
                >
                  Todos
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2" role="group" aria-label="Selecionar CLIs">
                {clis.map((cli) => {
                  const enabled = cli.available && cli.launchSupported
                  const active = selectedCliIds.includes(cli.id)
                  return (
                    <button
                      key={cli.id}
                      type="button"
                      onClick={() => enabled && onToggleCli(cli.id)}
                      disabled={!enabled}
                      aria-pressed={active}
                      className={cn(
                        "relative grid min-h-12 grid-cols-[22px_minmax(0,1fr)_18px] items-center gap-3 border-b border-[var(--rule)] px-4 text-left transition-colors odd:sm:border-r",
                        active
                          ? "bg-[var(--surface-hover)] text-[var(--ink)] shadow-[inset_0_-2px_0_var(--lime-ink)]"
                          : enabled
                            ? "text-[var(--ink-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
                            : "cursor-not-allowed text-[var(--ink-dim)] opacity-55",
                      )}
                      aria-label={enabled ? `${compactCliLabel(cli.id)} · ${cli.launchHint}` : `${compactCliLabel(cli.id)} · ${cli.installHint}`}
                    >
                      <CliLogo cliId={cli.id} active={active} />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold">{compactCliLabel(cli.id)}</span>
                        <span className="mt-0.5 block truncate text-[9.5px] text-[var(--ink-dim)]">
                          {enabled ? "Selecionável" : cli.available ? "Sem adapter" : "Não detectado"}
                        </span>
                      </span>
                      {active ? <Check size={13} className="text-[var(--lime-ink)]" /> : null}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-[var(--rule)] bg-[var(--paper-deep)] px-4 py-4 text-[12px] font-semibold text-[var(--ink-2)]">
                <OpenRouterLogo active={mode === "byok"} />
                {OPENROUTER_CLI_LABEL}
              </div>
              <div className="grid gap-2 p-4">
                <input
                  value={byokConfig.apiKey}
                  onChange={(event) => onByokConfigChange({ apiKey: event.target.value })}
                  type="password"
                  placeholder="API key"
                  className="h-11 border border-[var(--rule)] bg-[var(--paper-deep)] px-3 text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-dim)] focus:border-[var(--lime-ink)]"
                />
                <input
                  value={byokConfig.model}
                  onChange={(event) => onByokConfigChange({ model: event.target.value })}
                  placeholder="modelo"
                  className="h-11 border border-[var(--rule)] bg-[var(--paper-deep)] px-3 text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-dim)] focus:border-[var(--lime-ink)]"
                />
                {!byokReady ? (
                  <span className="px-1 text-[11px] text-[var(--ink-dim)]">OpenRouter exige chave e modelo.</span>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CliLogo({ cliId, active }: { cliId: ResearchCliId; active: boolean }) {
  const logo = cliLogoMeta(cliId)
  return (
    <span
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center border text-[10px] font-black leading-none",
        active
          ? "border-[var(--lime-ink)] bg-[var(--lime-ink)] text-black"
          : "border-[var(--rule-strong)] bg-[var(--paper-deep)] text-[var(--ink-2)]",
      )}
      style={{
        fontFamily: logo.fontFamily ?? MONO_FONT,
        color: active ? "#050505" : logo.color,
      }}
      aria-hidden="true"
      title={logo.title}
    >
      {logo.mark}
    </span>
  )
}

function OpenRouterLogo({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-grid h-6 w-6 shrink-0 place-items-center border text-[9px] font-black tracking-[-0.04em]",
        active
          ? "border-[var(--lime-ink)] bg-[var(--lime-ink)] text-black"
          : "border-[var(--rule-strong)] bg-[var(--paper-deep)] text-[var(--ink-2)]",
      )}
      style={{ fontFamily: MONO_FONT }}
      aria-hidden="true"
      title="OpenRouter"
    >
      OR
    </span>
  )
}

function RecentResearchList({
  runs,
  flushTop = false,
  onOpenDash,
  onOpenRun,
}: {
  runs: RecentResearchRun[]
  flushTop?: boolean
  onOpenDash: () => void
  onOpenRun: (slug: string) => void
}) {
  return (
    <section className={cn("text-left", flushTop ? "mt-0" : "mt-8 sm:mt-10")}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-7 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-[23px] font-black uppercase tracking-normal text-[var(--ink)] sm:text-[26px]" style={{ fontFamily: DISPLAY_FONT }}>
            Últimas pesquisas
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpenDash}
          className="inline-flex h-9 items-center gap-2.5 border border-[var(--rule-strong)] bg-[var(--surface)] px-3 font-bold uppercase text-[var(--ink)] transition-colors hover:border-[var(--lime-ink)] hover:bg-[var(--lime-ink)] hover:text-black sm:px-3.5"
          style={{ fontFamily: MONO_FONT, fontSize: "9.5px", letterSpacing: "0.18em" }}
        >
          <LayoutDashboard size={13} />
          Ver dashboard
        </button>
      </div>

      {runs.length > 0 ? (
        <div className="border border-[var(--rule)] bg-[var(--surface)]">
          {runs.map((run, index) => (
            <RecentResearchCard
              key={run.slug}
              run={run}
              index={index}
              onOpen={() => onOpenRun(run.slug)}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-32 place-items-center border border-[var(--rule)] bg-[var(--paper-deep)] px-5 py-8 text-center">
          <div>
            <FileText className="mx-auto mb-3 text-[var(--ink-3)]" size={22} />
            <p className="text-[14px] font-semibold text-[var(--ink)]">Nenhuma pesquisa indexada ainda</p>
            <p className="mt-1 text-[12px] leading-[1.45] text-[var(--ink-2)]">
              Assim que houver artefatos em docs/research/, as três pesquisas mais recentes aparecem aqui.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

function RecentResearchCard({
  run,
  index,
  onOpen,
}: {
  run: RecentResearchRun
  index: number
  onOpen: () => void
}) {
  const coverage = parseCoveragePercent(formatCoverage(run.coverage))
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative grid w-full gap-3 border-b border-[var(--rule-soft)] bg-[var(--surface)] px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-[var(--surface-hover)] sm:px-[22px] md:min-h-[88px] md:grid-cols-[144px_minmax(0,1fr)_140px_86px] md:items-center md:gap-4"
    >
      <span className="flex min-w-0 flex-wrap items-center gap-2.5 md:block">
        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--lime-ink)]" style={{ fontFamily: MONO_FONT }}>
          #{String(index + 1).padStart(2, "0")}
        </span>
        <CategoryChip category={run.category} />
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-dim)] md:mt-2 md:block" style={{ fontFamily: MONO_FONT }}>
          {formatResearchDate(run.date)}
        </span>
      </span>

      <span className="block min-w-0">
        <span className="line-clamp-2 block text-[15px] font-semibold leading-[1.28] text-[var(--ink)]">
          {run.displayTitle || run.title || run.slug}
        </span>
      </span>

      <span className="min-w-0 border-t border-[var(--rule-soft)] pt-3 md:border-l md:border-t-0 md:pl-3 md:pt-0">
        <span className="flex min-w-0 items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-2 text-[12px] font-medium tracking-[0.04em] text-[var(--ink)]" style={{ fontFamily: MONO_FONT }}>
            <span className="h-1.5 w-1.5 shrink-0 bg-[var(--lime-ink)] shadow-[0_0_8px_rgba(209,255,0,0.8)]" />
            <span className="truncate">{compactStatus(run.status)}</span>
          </span>
          <span className="shrink-0 text-[12px] font-medium tracking-[0.04em] text-[var(--ink)]" style={{ fontFamily: MONO_FONT }}>
            {formatCoverage(run.coverage)}
          </span>
        </span>
        {coverage !== null ? (
          <span className="mt-2 block h-[3px] bg-[var(--paper-deep)]">
            <span className="block h-full bg-[var(--lime-ink)] shadow-[0_0_6px_rgba(209,255,0,0.25)]" style={{ width: `${coverage}%` }} />
          </span>
        ) : null}
        <span className="mt-2 block truncate text-[9px] uppercase tracking-[0.16em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
          Fnt · {run.sources || "--"}
        </span>
      </span>

      <span className="flex min-w-0 items-center justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-[var(--ink-dim)] md:flex-col md:items-end md:justify-center md:text-right" style={{ fontFamily: MONO_FONT }}>
        <span className="whitespace-nowrap">{run.files} arq.</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[var(--lime-ink)]">
          Abrir
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </span>
    </button>
  )
}

function CategoryChip({ category }: { category: string }) {
  const colorClass = categoryColorClass(category)
  return (
    <span className="inline-flex items-center gap-2 border border-[var(--rule)] bg-[var(--surface)] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--ink-2)]" style={{ fontFamily: MONO_FONT }}>
      <span className={cn("h-1.5 w-1.5", colorClass)} />
      {formatCategory(category)}
    </span>
  )
}

function SessionPromptSummary({
  query,
  runs,
  consolidationRun,
  methodId,
  depth,
}: {
  query: string
  runs: ResearchRunState[]
  consolidationRun: ResearchRunState | null
  methodId: ResearchMethodId
  depth: ResearchRunRequest["depth"]
}) {
  const visibleRuns = consolidationRun ? [...runs, consolidationRun] : runs
  const runtimeText = visibleRuns.length > 0
    ? visibleRuns.map((run) => cliLabel(run.cliId)).join(" · ")
    : "Restaurando runtimes da URL"
  const completedReportRun =
    isWorkflowComplete(consolidationRun)
      ? consolidationRun
      : runs.find(isWorkflowComplete)
  return (
    <div className="grid gap-0">
      <div className="bg-[var(--paper-deep)] px-5 py-5">
        <p className="text-[18px] leading-[1.55] text-[var(--ink)]">
          {query || "Restaurando pergunta da pesquisa..."}
        </p>
      </div>
      <div className="grid gap-[1px] border-t border-[var(--rule)] bg-[var(--rule)] sm:grid-cols-3">
        <SessionMetaCell label="Runtimes" value={runtimeText} />
        <SessionMetaCell label="Modo" value={researchMethodLabel(methodId)} />
        <SessionMetaCell label="Profundidade" value={researchDepthLabel(depth)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rule)] bg-[var(--surface-hover)] px-5 py-3">
        <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--lime-ink)]" style={{ fontFamily: MONO_FONT }}>
          Sessão fixada pela URL · nova submissão bloqueada nesta aba.
        </p>
        {completedReportRun ? (
          <a
            href={`/observatory/research?slug=${encodeURIComponent(completedReportRun.outputSlug)}`}
            className="inline-flex min-h-8 items-center gap-2 border border-[var(--lime-ink)] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--lime-ink)] transition-colors hover:bg-[var(--lime-ink)] hover:text-black"
            style={{ fontFamily: MONO_FONT }}
          >
            <ExternalLink size={13} />
            Relatório completo
          </a>
        ) : null}
      </div>
    </div>
  )
}

function SessionMetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-[var(--surface)] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
        {label}
      </p>
      <p className="mt-1 truncate text-[13px] text-[var(--ink)]">{value}</p>
    </div>
  )
}

function ExecutionEmptyState({
  icon,
  title,
  body,
}: {
  icon: ReactNode
  title: string
  body: string
}) {
  return (
    <section className="border border-dashed border-[var(--rule)] bg-[var(--paper-deep)]">
      <div className="grid min-h-40 place-items-center p-5 text-center">
        <div>
          {icon}
          <p className="text-[14px] font-semibold">{title}</p>
          <p className="mt-1 text-[12px] leading-[1.45] text-[var(--ink-2)]">{body}</p>
        </div>
      </div>
    </section>
  )
}

function SectionHeading({
  index,
  title,
  meta,
  accent,
}: {
  index: string
  title: string
  meta?: string
  accent?: string
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 py-5">
      <h2 className="flex items-baseline gap-3 text-[22px] font-black uppercase tracking-normal text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
          [{index}]
        </span>
        {title}
        {accent ? <span className="text-[var(--lime-ink)]">{accent}</span> : null}
      </h2>
      {meta ? (
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
          {meta}
        </span>
      ) : null}
    </div>
  )
}

function BatchStatus({
  runs,
  consolidationRun,
  focusedRunId,
  canConsolidate,
  isConsolidating,
  onConsolidate,
  retryingRunIds,
  onRetryRun,
  onFocus,
  onOpen,
}: {
  runs: ResearchRunState[]
  consolidationRun: ResearchRunState | null
  focusedRunId: string | null
  canConsolidate: boolean
  isConsolidating: boolean
  onConsolidate: () => void
  retryingRunIds: string[]
  onRetryRun: (run: ResearchRunState) => void
  onFocus: (runId: string) => void
  onOpen: (run: ResearchRunState) => void
}) {
  const visibleRuns = consolidationRun ? [...runs, consolidationRun] : runs
  const completedRuns = runs.filter(isWorkflowComplete)
  const activeRuns = runs.filter(isWorkflowPending)
  const failedRuns = runs.filter(isWorkflowFailed)
  const allParallelRunsFinished = runs.length > 0 && activeRuns.length === 0
  const showConsolidationPanel = Boolean(consolidationRun) || (runs.length >= 2 && allParallelRunsFinished)
  const focusedRun = visibleRuns.find((run) => run.runId === focusedRunId) ?? visibleRuns[0] ?? null

  return (
    <div className="grid gap-8 text-left">
      <RunStatsStrip
        runs={runs}
        activeCount={activeRuns.length}
        completedCount={completedRuns.length}
        failedCount={failedRuns.length}
        consolidationRun={consolidationRun}
      />

      <section>
        <SectionHeading
          index="02"
          title="Runtimes paralelos"
          meta={`${completedRuns.length} concluído${completedRuns.length === 1 ? "" : "s"} · ${activeRuns.length} em curso`}
        />
        <div
          className="grid gap-[1px] bg-[var(--rule)]"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}
        >
          {visibleRuns.map((run) => (
            <RuntimeRunCard
              key={run.runId}
              run={run}
              selected={run.runId === focusedRun?.runId}
              consolidation={run.runId === consolidationRun?.runId}
              onFocus={() => onFocus(run.runId)}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-8">
        {focusedRun ? (
          <>
            <SectionHeading
              index="03"
              title="Runtime"
              accent={focusedRun.runId === consolidationRun?.runId ? "Consolidação" : cliLabel(focusedRun.cliId)}
              meta={runtimeSummaryLabel(focusedRun)}
            />
            <FocusedRunConsole
              run={focusedRun}
              retrying={retryingRunIds.includes(focusedRun.runId)}
              onRetry={() => onRetryRun(focusedRun)}
              onOpen={() => onOpen(focusedRun)}
            />
          </>
        ) : null}
        {showConsolidationPanel ? (
          <ConsolidationPanel
            completedCount={completedRuns.length}
            totalCount={runs.length}
            canConsolidate={canConsolidate}
            isConsolidating={isConsolidating}
            consolidationRun={consolidationRun}
            onConsolidate={onConsolidate}
            onFocusConsolidation={() => consolidationRun && onFocus(consolidationRun.runId)}
          />
        ) : null}
      </div>
    </div>
  )
}

type PipelineStepState = "done" | "active" | "pending" | "failed"

function RunStatsStrip({
  runs,
  activeCount,
  completedCount,
  failedCount,
  consolidationRun,
}: {
  runs: ResearchRunState[]
  activeCount: number
  completedCount: number
  failedCount: number
  consolidationRun: ResearchRunState | null
}) {
  const totalSteps = Math.max(1, runs.reduce((total, run) => total + runStepTotal(run), 0))
  const doneSteps = runs.reduce((total, run) => total + runProgress(run).done, 0)
  const percent = Math.round((doneSteps / totalSteps) * 100)
  const newestRun = [...runs, consolidationRun]
    .filter((run): run is ResearchRunState => Boolean(run))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
  const elapsed = newestRun ? formatElapsed(newestRun.startedAt, newestRun.updatedAt) : "0s"
  const pipelineLabel = consolidationRun
    ? `consolidação · ${statusLabel(consolidationRun.status)}`
    : activeCount > 0
      ? `${activeCount} em curso`
      : failedCount > 0
        ? `${failedCount} com falha`
        : "runtimes finalizados"

  return (
    <section className="grid gap-[1px] border border-[var(--rule)] bg-[var(--rule-soft)] sm:grid-cols-2 lg:grid-cols-4" aria-label="Estatísticas da execução">
      <RunStatCard label="Runtimes" value={String(runs.length)} unit={activeCount > 0 ? "ativos" : "total"} trend={`${completedCount} done · ${activeCount} em curso`} />
      <RunStatCard label="Steps" value={String(doneSteps)} unit={`de ${totalSteps}`} trend={`${percent}% do pipeline paralelo`} positive />
      <RunStatCard label="Tempo" value={elapsed} unit="janela" trend={newestRun ? `${cliLabel(newestRun.cliId)} · ${formatRunTime(newestRun.updatedAt)}` : "sem run ativo"} />
      <RunStatCard label="Estado" value={failedCount > 0 ? "!" : activeCount > 0 ? "live" : "ok"} unit="pipeline" trend={pipelineLabel} positive={failedCount === 0} />
    </section>
  )
}

function RunStatCard({
  label,
  value,
  unit,
  trend,
  positive = false,
}: {
  label: string
  value: string
  unit: string
  trend: string
  positive?: boolean
}) {
  return (
    <article className="grid min-h-[128px] min-w-0 content-between bg-[var(--surface)] px-5 py-5">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
        {label}
      </p>
      <p className="flex min-w-0 items-baseline gap-2 text-[40px] font-black leading-none text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
        <span className="shrink-0">{value}</span>
        <span className="min-w-0 truncate text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
          {unit}
        </span>
      </p>
      <p
        className={cn("truncate text-[10.5px] tracking-[0.06em] text-[var(--ink-dim)]", positive && "text-[var(--lime-ink)]")}
        style={{ fontFamily: MONO_FONT }}
      >
        {trend}
      </p>
    </article>
  )
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--paper-deep)] px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
        {label}
      </p>
      <p className="mt-1 text-[24px] font-black text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
        {value}
      </p>
    </div>
  )
}

function RuntimeRunCard({
  run,
  selected,
  consolidation,
  onFocus,
}: {
  run: ResearchRunState
  selected: boolean
  consolidation: boolean
  onFocus: () => void
}) {
  const progress = runProgress(run)
  const totalSteps = runStepTotal(run)
  const lastLine = lastMeaningfulLine(run.log)
  const issueLines = runIssueLines(run.log, run.status === "failed")
  const hasLiveIssue = issueLines.length > 0 && run.status !== "completed"
  const displayLine = hasLiveIssue ? issueLines.at(-1) ?? lastLine : lastLine
  const percent = Math.round((progress.done / totalSteps) * 100)
  const currentStep = String(Math.min(totalSteps, Math.max(1, progress.done + (run.status === "completed" ? 0 : 1)))).padStart(2, "0")
  const workflowConfirmed = run.filesystem?.progress.status === "completed"
  const workflowFailed = run.filesystem?.progress.status === "failed"
  const cardStatus = run.status === "completed" ? (workflowConfirmed ? "FINAL" : workflowFailed ? "PIPELINE FALHA" : "PROCESSO OK") : run.status === "failed" ? "FALHA" : `[${currentStep}] AGORA`
  return (
    <button
      type="button"
      onClick={onFocus}
      aria-pressed={selected}
      className={cn(
        "relative grid min-h-[244px] overflow-hidden content-between gap-5 bg-[var(--surface)] p-5 text-left transition-colors hover:bg-[var(--surface-hover)]",
        selected && "bg-[var(--surface-hover)]",
      )}
    >
      {hasLiveIssue && run.status !== "failed" ? <span className="absolute inset-y-0 left-0 w-0.5 bg-[var(--warning-ink)]" /> : null}
      {run.status === "failed" ? <span className="absolute inset-y-0 left-0 w-0.5 bg-[var(--danger-ink)]" /> : null}
      {selected && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--lime-ink)] shadow-[0_0_14px_rgba(209,255,0,0.45)]" />}
      <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center border text-[11px] font-black uppercase",
            selected
              ? "border-[var(--lime-ink)] bg-[var(--lime-ink)] text-black"
              : "border-[var(--rule)] bg-[var(--paper)] text-[var(--ink-2)]",
          )}
          style={{ fontFamily: MONO_FONT }}
        >
          {consolidation ? "CO" : cliGlyph(run.cliId)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-[var(--ink)]">
            {consolidation ? "Consolidação" : cliLabel(run.cliId)}
          </span>
          <span className="mt-1 block truncate text-[10px] uppercase tracking-[0.10em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
            {statusLabel(run.status)} · {researchMethodLabel(run.methodId)}
          </span>
        </span>
        <StatusBadge status={run.status} exitCode={run.exitCode} hasIssue={hasLiveIssue} />
      </span>

      <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-end gap-3">
        <span className="text-[52px] font-black leading-none text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
          {String(progress.done).padStart(2, "0")}
        </span>
        <span className="min-w-0 text-[10.5px] uppercase tracking-[0.14em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
          <b className="block font-medium text-[var(--ink)]">de {String(totalSteps).padStart(2, "0")} steps</b>
          {run.status === "completed" ? (workflowConfirmed ? "concluído" : workflowFailed ? "pipeline falhou" : "aguardando pipeline") : run.status === "failed" ? "interrompido" : `${percent}% concluído`}
        </span>
      </span>

      <span className="grid gap-2">
        <span className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <span
              key={index}
              className={cn(
                "h-1 flex-1 bg-[rgba(245,244,231,0.08)]",
                index < progress.done && "bg-[var(--lime-ink)] shadow-[0_0_6px_rgba(209,255,0,0.32)]",
                run.status === "running" && index === progress.done && "animate-pulse bg-[var(--lime-ink)]",
                run.status === "failed" && index === progress.done && "bg-[var(--danger-ink)]",
              )}
            />
          ))}
        </span>
        <span className="flex items-center justify-between text-[10px] uppercase tracking-[0.10em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
          <span>{progress.label}</span>
          <span>{formatElapsed(run.startedAt, run.updatedAt)}</span>
        </span>
      </span>

      <span className="line-clamp-2 text-[11px] leading-[1.45] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
        <span className="text-[var(--ink-dim)]">{cardStatus} · </span>
        <b className="font-medium text-[var(--ink)]">{displayLine || "Aguardando saída do processo..."}</b>
      </span>
    </button>
  )
}

type RuntimeDetailStep = {
  id: string
  num: string
  short: string
  name: string
  desc: string
  state: PipelineStepState
  substeps: string[]
  meta: string
}

function FocusedRunConsole({
  run,
  retrying,
  onRetry,
  onOpen,
}: {
  run: ResearchRunState
  retrying: boolean
  onRetry: () => void
  onOpen: () => void
}) {
  const steps = buildRuntimeDetailSteps(run)
  const activeStep = steps.find((step) => step.state === "active" || step.state === "failed") ?? steps.at(-1)
  const doneCount = steps.filter((step) => step.state === "done").length
  const issueLines = runIssueLines(run.log, run.status === "failed")
  const hasLiveIssue = issueLines.length > 0 && run.status !== "completed"
  const workflowConfirmed = run.filesystem?.progress.status === "completed"
  const workflowFailed = run.filesystem?.progress.status === "failed"
  const liveLabel =
    run.status === "completed"
      ? workflowConfirmed ? "CONCLUÍDO" : workflowFailed ? "PIPELINE FALHOU" : "PROCESSO OK · PIPELINE PENDENTE"
      : run.status === "failed"
        ? "FALHA"
        : hasLiveIssue
          ? "ATENÇÃO · STDERR"
        : `EM EXECUÇÃO · ${activeStep?.num ?? "01"} DE ${String(steps.length || RUNTIME_STEP_TOTAL).padStart(2, "0")}`

  return (
    <section className="border border-[var(--rule)] bg-[var(--paper-deep)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--rule)] px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--lime-ink)]" style={{ fontFamily: MONO_FONT }}>
            Runtime · <span className="text-[var(--ink)]">{cliLabel(run.cliId)}</span>
          </p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--ink)]">{run.outputSlug}</p>
          <p className="mt-1 text-[11px] text-[var(--ink-3)]">
            {doneCount} steps concluídos · docs/research/{run.outputSlug}
          </p>
        </div>
        <StatusBadge status={run.status} exitCode={run.exitCode} hasIssue={hasLiveIssue} />
      </div>

      {issueLines.length > 0 ? <RuntimeIssuePanel run={run} lines={issueLines} /> : null}

      <RuntimePipeline steps={steps} liveLabel={liveLabel} run={run} />

      <div className="border-t border-[var(--rule)]">
        {steps.map((step) => (
          <RuntimeStepRow
            key={step.id}
            step={step}
            retrying={retrying}
            onRetry={run.status === "failed" && step.state === "failed" ? onRetry : undefined}
          />
        ))}
      </div>

      <TerminalOutput run={run} />

      <button
        type="button"
        onClick={onOpen}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 border-t border-[var(--rule)] px-3 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
        style={{ fontFamily: MONO_FONT }}
      >
        <ExternalLink size={14} />
        Abrir no Observatory
      </button>
    </section>
  )
}

type TerminalLineKind = "local" | "stdout" | "stderr" | "plain"

type TerminalLine = {
  kind: TerminalLineKind
  text: string
}

function TerminalOutput({ run }: { run: ResearchRunState }) {
  const lines = parseTerminalLines(run.log)
  const visibleLines = lines.length > 0 ? lines : [{ kind: "plain" as const, text: "Aguardando saída do processo..." }]
  const hasErrors = lines.some((line) => line.kind === "stderr")
  const isLive = run.status === "running" || run.status === "queued"
  const filesystemLabel = filesystemStatusLabel(run)
  const latestFilePath = run.filesystem?.latestFiles[0]?.path
  const streamLabel = hasErrors
    ? "stderr detectado"
    : isLive
      ? run.status === "queued"
        ? "aguardando runtime"
        : "rodando"
      : run.status === "completed"
        ? "stream concluído"
        : run.status === "failed"
          ? "stream interrompido"
          : "stream limpo"
  const prompt = terminalPrompt()

  return (
    <div className="border-t border-[var(--rule)] bg-[var(--surface-console)]">
      <div className="grid border-b border-[var(--rule)] bg-[rgba(0,0,0,0.24)] md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-center gap-3 px-4 py-3">
          <span className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 border border-[rgba(237,70,9,0.68)] bg-[rgba(237,70,9,0.16)]" />
            <span className="h-2.5 w-2.5 border border-[rgba(245,158,11,0.62)] bg-[rgba(245,158,11,0.14)]" />
            <span className="h-2.5 w-2.5 border border-[rgba(209,255,0,0.62)] bg-[rgba(245,244,231,0.08)]" />
          </span>
          <span className="min-w-0 truncate text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
            Terminal · linhas de comando
          </span>
        </div>
        <div
          className="flex min-w-0 items-center justify-between gap-4 border-t border-[var(--rule-soft)] px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-dim)] md:border-l md:border-t-0"
          style={{ fontFamily: MONO_FONT }}
        >
          <span
            className={cn(
              "inline-flex min-w-0 items-center gap-2 truncate",
              hasErrors && "text-[var(--danger-ink)]",
              isLive && !hasErrors && "text-[var(--lime-ink)]",
            )}
          >
            {isLive ? <span className="h-1.5 w-1.5 shrink-0 animate-pulse bg-[var(--lime-ink)] shadow-[0_0_10px_rgba(209,255,0,0.75)]" aria-hidden="true" /> : null}
            <span className="truncate">{streamLabel}</span>
            {isLive ? <span className="shrink-0 animate-pulse text-[var(--lime-ink)]" aria-hidden="true">|</span> : null}
          </span>
          <span
            className="hidden min-w-0 truncate text-[var(--ink-3)] sm:inline"
            title={latestFilePath ? `Último arquivo: ${latestFilePath}` : undefined}
          >
            {filesystemLabel}
          </span>
          <span className="shrink-0">{formatRunTime(run.updatedAt)}</span>
        </div>
      </div>

      <div className="border-b border-[var(--rule-soft)] px-4 py-3">
        <p className="flex min-w-0 items-center gap-2 text-[11px] leading-none text-[var(--ink-2)]" style={{ fontFamily: MONO_FONT }}>
          <span className="text-[var(--lime-ink)]">{prompt}</span>
          <span className="text-[var(--ink-dim)]">:</span>
          <span className="min-w-0 truncate text-[var(--ink-3)]">docs/research/{run.outputSlug}</span>
          {isLive ? <span className="ml-1 h-4 w-1.5 shrink-0 animate-pulse bg-[var(--lime-ink)] shadow-[0_0_12px_rgba(209,255,0,0.7)]" aria-hidden="true" /> : null}
        </p>
      </div>

      <div className="max-h-[34vh] min-h-48 overflow-auto py-3" role="log" aria-label="Saída do processo">
        {visibleLines.map((line, index) => (
          <div
            key={`${index}-${line.kind}-${line.text}`}
            className="grid min-w-full grid-cols-[48px_86px_minmax(0,1fr)] items-start gap-3 px-4 py-0.5 text-[11px] leading-[1.55] hover:bg-[rgba(245,244,231,0.035)]"
            style={{ fontFamily: MONO_FONT }}
          >
            <span className="select-none text-right text-[var(--ink-dim)]">{String(index + 1).padStart(2, "0")}</span>
            <span
              className={cn(
                "select-none uppercase tracking-[0.12em]",
                line.kind === "local" && "text-[var(--lime-ink)]",
                line.kind === "stdout" && "text-[var(--blue-ink)]",
                line.kind === "stderr" && "text-[var(--danger-ink)]",
                line.kind === "plain" && "text-[var(--ink-dim)]",
              )}
            >
              {terminalLineLabel(line.kind)}
            </span>
            <span
              className={cn(
                "whitespace-pre-wrap break-words",
                line.kind === "stderr" ? "text-[var(--danger-ink)]" : "text-[var(--ink-2)]",
                line.kind === "local" && "text-[var(--ink-3)]",
              )}
            >
              {line.text || " "}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RuntimeIssuePanel({ run, lines }: { run: ResearchRunState; lines: string[] }) {
  const failed = run.status === "failed"
  return (
    <div
      className={cn(
        "border-b border-[var(--rule)] px-4 py-3",
        failed ? "bg-[rgba(239,68,68,0.08)]" : "bg-[rgba(245,158,11,0.08)]",
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={17}
          className={cn("mt-0.5 shrink-0", failed ? "text-[var(--danger-ink)]" : "text-[var(--warning-ink)]")}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.14em]",
              failed ? "text-[var(--danger-ink)]" : "text-[var(--warning-ink)]",
            )}
            style={{ fontFamily: MONO_FONT }}
          >
            {failed ? "Falha do runtime" : "Atenção do runtime"}
          </p>
          <div className="mt-2 grid gap-1">
            {lines.slice(-4).map((line, index) => (
              <p key={`${line}-${index}`} className="text-[11px] leading-[1.45] text-[var(--ink-2)]" style={{ fontFamily: MONO_FONT }}>
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function RuntimePipeline({
  steps,
  liveLabel,
  run,
}: {
  steps: RuntimeDetailStep[]
  liveLabel: string
  run: ResearchRunState
}) {
  const doneCount = steps.filter((step) => step.state === "done").length
  const hasActive = steps.some((step) => step.state === "active" || step.state === "failed")
  const fillRatio = steps.length > 1 ? (hasActive ? doneCount : steps.length - 1) / (steps.length - 1) : 1
  const trackStyle = {
    gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
    "--pipeline-fill": `calc((100% - 100% / ${steps.length}) * ${fillRatio})`,
  } as CSSProperties

  return (
    <div className="bg-[var(--surface)] px-6 py-6">
      <div
        className="mb-6 flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-dim)]"
        style={{ fontFamily: MONO_FONT }}
      >
        <span>
          Pipeline · <b className="font-medium text-[var(--ink)]">{cliLabel(run.cliId)}</b> · {run.runId.slice(0, 16)}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-2",
            run.status === "failed"
              ? "text-[var(--danger-ink)]"
              : liveLabel.startsWith("ATENÇÃO")
                ? "text-[var(--warning-ink)]"
                : "text-[var(--lime-ink)]",
          )}
        >
          {run.status === "running" || run.status === "queued" ? <span className="h-1.5 w-1.5 animate-pulse bg-[var(--lime-ink)]" /> : null}
          {liveLabel}
        </span>
      </div>

      <div className="relative grid gap-2" style={trackStyle}>
        <span className="absolute left-[calc(100%/14)] right-[calc(100%/14)] top-3 h-px bg-[var(--rule)]" />
        <span className="absolute left-[calc(100%/14)] top-3 h-px w-[var(--pipeline-fill)] bg-[var(--blue-ink)] shadow-[0_0_8px_rgba(0,153,255,0.18)]" />
        {steps.map((step) => (
          <div key={step.id} className="relative z-10 grid justify-items-center gap-2 text-center">
            <span
              className={cn(
                "grid h-7 w-7 place-items-center border bg-[var(--paper-deep)] text-[10px] font-bold",
                step.state === "done" && "border-[var(--ink)] bg-[var(--ink)] text-black",
                step.state === "active" && "border-[var(--lime-ink)] text-[var(--lime-ink)] shadow-[0_0_0_4px_rgba(209,255,0,0.08),0_0_18px_rgba(209,255,0,0.22)]",
                step.state === "failed" && "border-[var(--danger-ink)] text-[var(--danger-ink)]",
                step.state === "pending" && "border-[var(--rule)] text-[var(--ink-dim)]",
              )}
              style={{ fontFamily: MONO_FONT }}
            >
              {step.state === "done" ? <Check size={13} strokeWidth={3} /> : step.num}
            </span>
            <span
              className={cn(
                "hidden text-[10px] uppercase tracking-[0.10em] sm:block",
                step.state === "done" && "text-[var(--ink)]",
                step.state === "active" && "text-[var(--lime-ink)]",
                step.state === "pending" && "text-[var(--ink-dim)]",
                step.state === "failed" && "text-[var(--danger-ink)]",
              )}
              style={{ fontFamily: MONO_FONT }}
            >
              {step.short}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RuntimeStepRow({
  step,
  retrying,
  onRetry,
}: {
  step: RuntimeDetailStep
  retrying?: boolean
  onRetry?: () => void
}) {
  return (
    <article
      className={cn(
        "relative grid gap-0 border-b border-[var(--rule-soft)] last:border-b-0 lg:grid-cols-[76px_36px_minmax(0,1fr)_minmax(190px,260px)_108px]",
        step.state === "active" && "border-l-2 border-l-[var(--lime-ink)] bg-[var(--surface-hover)]",
        step.state === "failed" && "border-l-2 border-l-[var(--danger-ink)]",
      )}
    >
      <div
        className={cn(
          "flex items-center px-4 py-3 text-[11px] font-semibold tracking-[0.08em] text-[var(--ink-dim)] lg:justify-center lg:border-r lg:border-[var(--rule-soft)] lg:px-0",
          (step.state === "done" || step.state === "active") && "text-[var(--lime-ink)]",
          step.state === "failed" && "text-[var(--danger-ink)]",
        )}
        style={{ fontFamily: MONO_FONT }}
      >
        [{step.num}]
      </div>
      <div
        className={cn(
          "hidden items-center justify-center text-[var(--ink-3)] lg:flex",
          (step.state === "done" || step.state === "active") && "text-[var(--lime-ink)]",
          step.state === "failed" && "text-[var(--danger-ink)]",
        )}
      >
        <RuntimeStepIcon step={step} />
      </div>
      <div className="px-4 pb-3 lg:py-4 lg:pl-0 lg:pr-4">
        <p
          className={cn(
            "text-[15px] font-medium text-[var(--ink)]",
            step.state === "pending" && "text-[var(--ink-2)]",
          )}
        >
          {step.name}
        </p>
        <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
          {step.desc}
        </p>
      </div>
      <div className="grid content-center gap-1 px-4 pb-4 lg:py-4 lg:pl-0 lg:pr-4">
        {step.substeps.slice(0, 3).map((substep) => (
          <span key={substep} className="flex min-w-0 items-center gap-2 text-[10.5px] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
            <span
              className={cn(
                "grid h-3 w-3 shrink-0 place-items-center text-[var(--ink-dim)]",
                (step.state === "done" || step.state === "active") && "text-[var(--lime-ink)]",
                step.state === "failed" && "text-[var(--danger-ink)]",
              )}
            >
              {step.state === "done" ? <Check size={10} strokeWidth={3} /> : <Circle size={8} fill="currentColor" />}
            </span>
            <span className="truncate">{substep}</span>
          </span>
        ))}
        {step.state === "active" ? (
          <span className="mt-2 h-[3px] overflow-hidden bg-[var(--paper-deep)]">
            <span className="block h-full w-1/3 animate-pulse bg-[var(--lime-ink)] shadow-[0_0_8px_rgba(209,255,0,0.35)]" />
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--rule-soft)] px-4 py-3 lg:flex-col lg:items-end lg:justify-center lg:border-l lg:border-t-0 lg:border-[var(--rule-soft)]">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            title="Tentar de Novo"
            className="inline-flex h-6 items-center gap-1.5 bg-[var(--danger-ink)] px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--ink)] transition-opacity hover:opacity-85 disabled:opacity-60"
            style={{ fontFamily: MONO_FONT }}
          >
            <RefreshCcw size={10} className={cn(retrying && "animate-spin")} />
            {retrying ? "Retrying" : "Retry"}
          </button>
        ) : (
          <RuntimeStepBadge state={step.state} />
        )}
        <span className="text-[10px] tracking-[0.08em] text-[var(--ink-dim)]" style={{ fontFamily: MONO_FONT }}>
          {step.meta}
        </span>
      </div>
    </article>
  )
}

function RuntimeStepIcon({ step }: { step: RuntimeDetailStep }) {
  if (step.id === "prompt") return <Search size={17} />
  if (step.id === "boot") return <Terminal size={17} />
  if (step.id === "context") return <Radar size={17} />
  if (step.id === "evidence") return <FileText size={17} />
  if (step.id === "artifacts") return <Settings size={17} />
  if (step.id === "validate") return <Check size={17} />
  return <ExternalLink size={17} />
}

function RuntimeStepBadge({ state }: { state: PipelineStepState }) {
  const label = state === "done" ? "DONE" : state === "active" ? "RUNNING" : state === "failed" ? "FAILED" : "PENDING"
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 px-2 text-[9px] font-semibold uppercase tracking-[0.14em]",
        state === "done" && "bg-[var(--lime-ink)] text-black",
        state === "active" && "bg-[var(--lime-ink)] text-black",
        state === "failed" && "bg-[var(--danger-ink)] text-[var(--ink)]",
        state === "pending" && "border border-[var(--rule)] text-[var(--ink-3)]",
      )}
      style={{ fontFamily: MONO_FONT }}
    >
      {state === "active" ? <Loader2 size={10} className="animate-spin" /> : null}
      {label}
    </span>
  )
}

function ConsolidationPanel({
  completedCount,
  totalCount,
  canConsolidate,
  isConsolidating,
  consolidationRun,
  onConsolidate,
  onFocusConsolidation,
}: {
  completedCount: number
  totalCount: number
  canConsolidate: boolean
  isConsolidating: boolean
  consolidationRun: ResearchRunState | null
  onConsolidate: () => void
  onFocusConsolidation: () => void
}) {
  const readyLabel =
    consolidationRun
      ? statusLabel(consolidationRun.status)
      : canConsolidate
        ? "pronto"
        : `${completedCount}/${Math.max(totalCount, 2)} concluídas`

  return (
    <section className="grid gap-4 border border-[var(--rule)] bg-[var(--paper-deep)] p-4 md:grid-cols-[minmax(0,1fr)_260px] md:items-end">
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
          Consenso
        </p>
        <p className="mt-2 text-[22px] font-black uppercase leading-none text-[var(--ink)]" style={{ fontFamily: DISPLAY_FONT }}>
          Consolidar
        </p>
        <p className="mt-3 text-[12px] leading-[1.55] text-[var(--ink-2)]">
          Compare as saídas dos runtimes e gere uma pasta consolidada com consenso, dissensos e lacunas.
        </p>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-[1px] bg-[var(--rule)]">
          <MetricCell label="Estado" value={readyLabel} />
        </div>

        <button
          type="button"
          onClick={onConsolidate}
          disabled={!canConsolidate}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
            canConsolidate
              ? "bg-[var(--lime-ink)] text-black hover:brightness-95"
              : "bg-[var(--ink-faint)] text-[var(--ink-dim)]",
          )}
          style={{ fontFamily: MONO_FONT }}
        >
          <FileText size={14} />
          {isConsolidating ? "Consolidando" : "Consolidar pesquisas"}
        </button>

        {consolidationRun && (
          <button
            type="button"
            onClick={onFocusConsolidation}
            className="inline-flex min-h-10 items-center justify-center border border-[var(--rule)] px-3 text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)] transition-colors hover:border-[var(--lime-ink)] hover:text-[var(--ink)]"
            style={{ fontFamily: MONO_FONT }}
          >
            Ver consolidação
          </button>
        )}
      </div>
    </section>
  )
}

function StatusBadge({
  status,
  exitCode,
  hasIssue = false,
}: {
  status: ResearchRunState["status"]
  exitCode: number | null
  hasIssue?: boolean
}) {
  const done = status === "completed"
  const failed = status === "failed"
  const warning = hasIssue && !done && !failed
  const label = done ? "ok" : failed ? (exitCode === null ? "falha" : `exit ${exitCode}`) : warning ? "atenção" : "ativo"
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center border px-2 text-[9px] uppercase tracking-[0.14em]",
        done && "border-[var(--lime-ink)] bg-[var(--lime-ink)] text-black",
        failed && "border-[var(--danger-ink)] text-[var(--danger-ink)]",
        warning && "border-[var(--warning-ink)] text-[var(--warning-ink)]",
        !done && !failed && !warning && "border-[var(--rule)] text-[var(--ink-3)]",
      )}
      style={{ fontFamily: MONO_FONT }}
    >
      {label}
    </span>
  )
}

function statusLabel(status: ResearchRunState["status"]) {
  if (status === "queued") return "fila"
  if (status === "running") return "rodando"
  if (status === "completed") return "concluída"
  return "falhou"
}

function isWorkflowComplete(run: ResearchRunState | null | undefined) {
  return Boolean(run && run.status === "completed" && run.filesystem?.progress.status === "completed")
}

function isWorkflowFailed(run: ResearchRunState | null | undefined) {
  return Boolean(run && (run.status === "failed" || run.filesystem?.progress.status === "failed"))
}

function isWorkflowPending(run: ResearchRunState) {
  if (isWorkflowFailed(run)) return false
  if (run.status === "running" || run.status === "queued") return true
  return run.status === "completed" && run.filesystem?.progress.status !== "completed"
}

function researchMethodLabel(methodId: string) {
  return methodById(methodId).label
}

function methodDisplayName(label: string) {
  const lower = label.toLocaleLowerCase("pt-BR")
  return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1)
}

function researchMethodTooltip(method: (typeof RESEARCH_METHODS)[number]) {
  return `${method.description} Skill: ${method.skill.name}. Workflow: ${method.workflow.id}. Agente: ${method.primaryAgent}.`
}

function researchDepthLabel(depth: ResearchRunRequest["depth"]) {
  return depth === "deep" ? "Profunda" : "Profunda"
}

function compactCliLabel(cliId: ResearchCliId) {
  if (cliId === "claude") return "Claude"
  if (cliId === "codex") return "Codex"
  if (cliId === "gemini") return "Gemini"
  if (cliId === "research-core") return "Research Core"
  return "OpenRouter"
}

function sessionHeadline(runs: ResearchRunState[], consolidationRun: ResearchRunState | null) {
  if (consolidationRun?.status === "running" || consolidationRun?.status === "queued") return "consolidação"
  if (runs.some(isWorkflowPending)) return "andamento"
  if (isWorkflowComplete(consolidationRun)) return "consolidada"
  if (runs.length > 0 && runs.every(isWorkflowComplete)) return "concluída"
  if (runs.length > 0 && runs.every(isWorkflowFailed)) return "falha"
  return "restauração"
}

function runtimeSummaryLabel(run: ResearchRunState) {
  const steps = buildRuntimeDetailSteps(run)
  const done = steps.filter((step) => step.state === "done").length
  const active = steps.filter((step) => step.state === "active").length
  const failed = steps.filter((step) => step.state === "failed").length
  const pending = steps.filter((step) => step.state === "pending").length
  if (failed > 0) return `${steps.length} steps · ${done} concluídos · ${failed} falhou · ${pending} pendentes`
  if (run.status === "completed" && pending === 0) return `${steps.length} steps · todos concluídos · total ${formatElapsed(run.startedAt, run.updatedAt)}`
  if (run.status === "completed") return `${steps.length} steps · processo finalizado · ${pending} pendentes no pipeline`
  return `${steps.length} steps · ${done} concluídos · ${active} em curso · ${pending} pendentes`
}

function buildRuntimeDetailSteps(run: ResearchRunState): RuntimeDetailStep[] {
  const phaseSteps = runtimePipelinePhaseSteps(run)
  if (phaseSteps.length > 0) return phaseSteps

  const progress = runProgress(run)
  const logLines = meaningfulLogLines(run.log)
  const latest = lastMeaningfulLine(run.log)
  const stdoutCount = logLines.filter((line) => line.startsWith("[stdout]")).length
  const stderrCount = logLines.filter((line) => line.startsWith("[stderr]")).length
  const issueLines = runIssueLines(run.log, run.status === "failed")
  const latestIssue = issueLines.at(-1)
  const finalLine = logLines.findLast((line) => line.includes("processo finalizado"))

  const templates = [
    {
      id: "prompt",
      short: "Prompt",
      name: "Receber instrução de pesquisa",
      desc: `Pergunta fixada na URL com modo ${researchMethodLabel(run.methodId)} e slug ${run.outputSlug}.`,
      substeps: [`Runtime · ${cliLabel(run.cliId)}`, `Slug · ${run.outputSlug}`, `Início · ${formatRunTime(run.startedAt)}`],
    },
    {
      id: "boot",
      short: "Boot",
      name: "Inicializar CLI local",
      desc: "Processo criado no workspace do Sinkra Hub com stdin controlado pelo AIOX Research.",
      substeps: [`Run · ${run.runId.slice(0, 22)}`, "Workspace · sinkra-hub", `Estado · ${statusLabel(run.status)}`],
    },
    {
      id: "context",
      short: "Contexto",
      name: "Ler contrato e contexto",
      desc: "Carrega o prompt técnico, restrições de escrita e contrato de artefatos em docs/research.",
      substeps: ["Protocolo · inline", "Saída · README/report/recommendations", "Governança · sem escrita fora de docs/research"],
    },
    {
      id: "evidence",
      short: "Evidência",
      name: "Investigar fontes e claims",
      desc: latestIssue
        ? `Último alerta recebido: ${latestIssue}`
        : latest
          ? `Último sinal recebido: ${latest}`
          : "Aguardando os primeiros eventos do runtime.",
      substeps: [
        stdoutCount > 0 ? `stdout · ${stdoutCount} evento${stdoutCount === 1 ? "" : "s"}` : "stdout · aguardando",
        stderrCount > 0 ? `stderr · ${stderrCount} evento${stderrCount === 1 ? "" : "s"}` : "stderr · limpo até agora",
        issueLines.length > 0 ? `alertas · ${issueLines.length}` : `Log · ${logLines.length} linha${logLines.length === 1 ? "" : "s"}`,
      ],
    },
    {
      id: "artifacts",
      short: "Artefatos",
      name: "Materializar pacote da pesquisa",
      desc: "Escreve a pasta canônica com métricas, fontes, recomendações, grafo e matrizes quando defensáveis.",
      substeps: ["README.md", "metrics.yaml", "sources.yaml / research-graph.json"],
    },
    {
      id: "validate",
      short: "Validar",
      name: "Validar saída e rastreabilidade",
      desc: "Confere se a execução fechou sem erro e se o runtime reportou artefatos ausentes ou lacunas.",
      substeps: [
        finalLine ? finalLine.replace(/^\[dash\]\s*/i, "") : "Processo ainda aberto",
        run.exitCode === null ? "Exit · pendente" : `Exit · ${run.exitCode}`,
        `Atualizado · ${formatRunTime(run.updatedAt)}`,
      ],
    },
    {
      id: "finish",
      short: "Final",
      name: "Disponibilizar no Observatory",
      desc: "Quando o runtime concluir, o pacote pode ser aberto no Observatory para leitura, comparação e consolidação.",
      substeps: [`Destino · docs/research/*-${run.outputSlug}`, "Ação · abrir no Observatory", "Consenso · disponível com 2+ runs concluídos"],
    },
  ]

  return templates.map((template, index) => ({
    ...template,
    num: String(index + 1).padStart(2, "0"),
    state: runtimeStepState(run.status, progress.done, index),
    meta: runtimeStepMeta(run, index),
  }))
}

function runtimeStepState(status: ResearchRunState["status"], completedSteps: number, index: number): PipelineStepState {
  if (status === "completed") return "done"
  if (status === "failed") {
    if (index < completedSteps) return "done"
    if (index === completedSteps) return "failed"
    return "pending"
  }
  if (index < completedSteps) return "done"
  if (index === completedSteps) return "active"
  return "pending"
}

function runtimeStepMeta(run: ResearchRunState, index: number) {
  const completedSteps = runProgress(run).done
  const totalSteps = runStepTotal(run)
  if (run.status === "completed") return index === totalSteps - 1 ? "final" : "ok"
  if (run.status === "failed" && index >= completedSteps) return index === completedSteps ? "erro" : "pendente"
  if (index < completedSteps) return "ok"
  if (index === completedSteps) return run.status === "queued" ? "fila" : "stream"
  return "pendente"
}

function runProgress(run: ResearchRunState) {
  const totalSteps = runStepTotal(run)
  const lines = meaningfulLogLines(run.log).length
  const filesystemDone = Math.max(0, Math.min(totalSteps, run.filesystem?.progress.doneSteps ?? 0))
  if (run.status === "completed" && run.filesystem?.progress.status === "completed") {
    return { done: totalSteps, label: `${String(totalSteps).padStart(2, "0")} de ${String(totalSteps).padStart(2, "0")}` }
  }
  if (run.status === "completed" && run.filesystem?.progress.status === "failed") return { done: filesystemDone, label: "pipeline falhou" }
  if (run.status === "completed") return { done: Math.max(filesystemDone, Math.min(totalSteps - 1, 1)), label: "pipeline pendente" }
  if (run.status === "failed") return { done: Math.max(filesystemDone, Math.max(1, Math.min(totalSteps - 1, Math.ceil(lines / 8)))), label: "interrompido" }
  if (run.status === "queued") return { done: 0, label: `01 de ${String(totalSteps).padStart(2, "0")}` }
  const activeStep = Math.max(2, Math.min(Math.max(2, totalSteps - 1), 2 + Math.floor(lines / 10)))
  const done = Math.max(filesystemDone, activeStep - 1)
  const labelStep = Math.min(totalSteps, Math.max(1, done + 1))
  return { done, label: `${String(labelStep).padStart(2, "0")} de ${String(totalSteps).padStart(2, "0")}` }
}

function runStepTotal(run: ResearchRunState) {
  return Math.max(1, run.filesystem?.progress.totalSteps ?? RUNTIME_STEP_TOTAL)
}

function runtimePipelinePhaseSteps(run: ResearchRunState): RuntimeDetailStep[] {
  const phases = run.filesystem?.progress.phases
  if (!phases?.length) return []
  const mapped = phases.map((phase, index) => {
    const status = phase.status || "unknown"
    return {
      id: phase.id || `phase-${index}`,
      num: String(index + 1).padStart(2, "0"),
      short: phase.phase || String(index + 1).padStart(2, "0"),
      name: phase.name || phase.id || "Fase do workflow",
      desc: phaseDescription(phase, run),
      state: phaseStepState(status),
      substeps: phaseSubsteps(phase, run),
      meta: phaseMeta(status),
    } satisfies RuntimeDetailStep
  })

  if (run.status === "running" && !mapped.some((step) => step.state === "active" || step.state === "failed")) {
    const firstPendingIndex = mapped.findIndex((step) => step.state === "pending")
    if (firstPendingIndex >= 0) mapped[firstPendingIndex] = { ...mapped[firstPendingIndex], state: "active", meta: "stream" }
  }

  return mapped
}

function phaseStepState(status: ResearchPipelinePhaseProgress["status"]): PipelineStepState {
  if (status === "completed" || status === "skipped") return "done"
  if (status === "failed" || status === "halted") return "failed"
  if (status === "in_progress") return "active"
  return "pending"
}

function phaseDescription(phase: ResearchPipelinePhaseProgress, run: ResearchRunState) {
  if (phase.status === "in_progress") return `Fase real em execução registrada em ${run.filesystem?.progress.sourcePath ?? "pipeline-state.yaml"}.`
  if (phase.status === "completed") return "Fase real concluída pelo workflow."
  if (phase.status === "failed" || phase.status === "halted") return "Workflow reportou bloqueio nesta fase."
  if (phase.checkpoint) return `Checkpoint ${phase.checkpoint} aguardando verdict.`
  return "Aguardando transição no pipeline-state.yaml real da skill."
}

function phaseSubsteps(phase: ResearchPipelinePhaseProgress, run: ResearchRunState) {
  return [
    `Status · ${phase.status}`,
    phase.checkpoint ? `Checkpoint · ${phase.checkpoint}` : `Runtime · ${cliLabel(run.cliId)}`,
    phase.verdict ? `Verdict · ${phase.verdict}` : `Fonte · ${run.filesystem?.progress.sourcePath ?? "pipeline-state.yaml"}`,
  ]
}

function phaseMeta(status: ResearchPipelinePhaseProgress["status"]) {
  if (status === "completed" || status === "skipped") return "ok"
  if (status === "failed" || status === "halted") return "erro"
  if (status === "in_progress") return "stream"
  return "pendente"
}

function meaningfulLogLines(log: string) {
  return log
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function lastMeaningfulLine(log: string) {
  const lines = meaningfulLogLines(log)
  const last = lines.at(-1) ?? ""
  return compactLogLine(last)
}

function compactLogLine(line: string) {
  return line
    .replace(/^\[(stdout|stderr|dash|localhost)\]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function runIssueLines(log: string, includeAnyStderr = false) {
  const issuePatterns = [
    /attempt\s+\d+\s+failed/i,
    /exhausted your capacity/i,
    /\bquota\b/i,
    /\brate\s*limit/i,
    /\b429\b/i,
    /\berror\b/i,
    /\berro\b/i,
    /\bfailed\b/i,
    /\bfalh/i,
    /exception/i,
    /timeout/i,
    /timed out/i,
    /permission denied/i,
    /unauthorized/i,
    /forbidden/i,
  ]

  let currentStream: "stdout" | "stderr" | null = null
  return meaningfulLogLines(log)
    .flatMap((rawLine) => {
      const streamMatch = rawLine.match(/^\[(stdout|stderr)\]\s*(.*)$/i)
      const bracketMatch = rawLine.match(/^\[([a-z]+)\]\s*(.*)$/i)
      let line = rawLine

      if (streamMatch) {
        currentStream = streamMatch[1]?.toLowerCase() === "stderr" ? "stderr" : "stdout"
        line = streamMatch[2] ?? ""
      } else if (bracketMatch) {
        currentStream = null
        line = bracketMatch[2] ?? rawLine
      }

      const compacted = compactLogLine(line)
      if (!compacted) return []

      const matchesIssue = issuePatterns.some((pattern) => pattern.test(compacted)) && currentStream !== "stdout"
      if (matchesIssue || (includeAnyStderr && currentStream === "stderr")) return [compacted]
      return []
    })
    .slice(-8)
}

function parseTerminalLines(log: string): TerminalLine[] {
  return log.split("\n").flatMap((rawLine): TerminalLine[] => {
    const line = rawLine.trimEnd()
    if (!line.trim()) return []

    const match = line.match(/^\[(stdout|stderr|dash|localhost)\]\s*(.*)$/i)
    if (!match) return [{ kind: "plain", text: line }]

    const source = match[1]?.toLowerCase()
    const text = match[2] ?? ""
    if (source === "stderr") return [{ kind: "stderr", text }]
    if (source === "stdout") return [{ kind: "stdout", text }]
    return [{ kind: "local", text }]
  })
}

function terminalLineLabel(kind: TerminalLineKind) {
  if (kind === "local") return "local"
  if (kind === "stdout") return "stdout"
  if (kind === "stderr") return "erro"
  return "shell"
}

function terminalPrompt() {
  return "alan@Mac-Studio-de-Alan"
}

function cliLabel(cliId: ResearchCliId) {
  if (cliId === "claude") return "Claude Code"
  if (cliId === "codex") return "Codex CLI"
  if (cliId === "gemini") return "Gemini CLI"
  if (cliId === "research-core") return "Research Core"
  if (cliId === "byok") return OPENROUTER_CLI_LABEL
  return "CLI"
}

function cliGlyph(cliId: ResearchCliId) {
  if (cliId === "claude") return "CC"
  if (cliId === "codex") return "CX"
  if (cliId === "gemini") return "GM"
  if (cliId === "research-core") return "RC"
  if (cliId === "byok") return "OR"
  return "AI"
}

function formatRunTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--:--"
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function filesystemStatusLabel(run: ResearchRunState) {
  const filesystem = run.filesystem
  if (!filesystem) return "docs: checando"
  if (filesystem.error) return "docs: aguardando pasta"
  if (filesystem.fileCount === 0) return "docs: sem arquivos"
  const activity = filesystem.latestActivityAt
    ? formatSince(filesystem.latestActivityAt, filesystem.checkedAt)
    : "sem alteração"
  return `${filesystem.fileCount} arquivos · ${activity}`
}

function formatSince(value: string, referenceValue?: string) {
  const valueTime = new Date(value).getTime()
  const referenceTime = referenceValue ? new Date(referenceValue).getTime() : Date.now()
  if (Number.isNaN(valueTime) || Number.isNaN(referenceTime)) return "sem horário"
  const seconds = Math.max(0, Math.round((referenceTime - valueTime) / 1000))
  if (seconds < 5) return "agora"
  if (seconds < 60) return `há ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `há ${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `há ${hours}h`
}

function formatResearchDate(value: string) {
  if (!value || value === "undated" || value === "undefined" || value === "—") return "sem data"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "").toUpperCase()
}

function createSpeechRecognition() {
  if (typeof window === "undefined") return null
  const speechWindow = window as Window & typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
  if (!Recognition) return null
  const recognition = new Recognition()
  recognition.lang = "pt-BR"
  recognition.continuous = true
  recognition.interimResults = true
  return recognition
}

function audioExtensionFromMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a"
  if (mimeType.includes("mpeg")) return "mp3"
  if (mimeType.includes("ogg")) return "ogg"
  if (mimeType.includes("wav")) return "wav"
  return "webm"
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function compactStatus(value: string) {
  if (!value) return "--"
  return value
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .slice(0, 2)
    .join(" ")
}

function formatCoverage(value: string) {
  if (!value || value === "--") return "--"
  return /^\d+(\.\d+)?$/.test(value) ? `${value}%` : value
}

function formatCategory(value: string) {
  if (!value) return "Other"
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.toUpperCase() === "AI" ? "AI" : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function docFileTitle(file: string) {
  const baseName = file.split("/").at(-1) ?? file
  return baseName
    .replace(/\.(md|yaml|yml|jsonl|json)$/i, "")
    .replace(/^\d{2}-/, "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.toUpperCase() === "README" ? "README" : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function docFileKind(file: string) {
  if (file === "README.md") return "overview"
  if (file.startsWith("00-")) return "query"
  if (file.startsWith("01-")) return "prompt"
  if (file.startsWith("02-")) return "report"
  if (file.startsWith("03-")) return "recommend"
  if (file.includes("source")) return "sources"
  if (file.includes("metric")) return "metrics"
  if (file.includes("state")) return "state"
  if (file.includes("log") || file.endsWith(".jsonl")) return "log"
  if (file.endsWith(".yaml") || file.endsWith(".yml")) return "metadata"
  return "artifact"
}

function parseCoveragePercent(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  return Math.max(0, Math.min(100, Number(match[1])))
}

function categoryColorClass(value: string) {
  const normalized = value.toLowerCase()
  if (normalized.includes("product") || normalized.includes("produto")) return "bg-[var(--danger-ink)]"
  if (normalized.includes("tech") || normalized.includes("tecnologia")) return "bg-[var(--blue-ink)]"
  if (normalized.includes("market") || normalized.includes("mercado")) return "bg-[var(--lime-ink)]"
  if (normalized.includes("bench")) return "bg-[var(--warning-ink)]"
  return "bg-[var(--ink-3)]"
}

function cliLogoMeta(cliId: ResearchCliId) {
  if (cliId === "claude") {
    return {
      title: "Claude",
      mark: "C",
      color: "#D97757",
      fontFamily: SANS_FONT,
    }
  }
  if (cliId === "codex") {
    return {
      title: "Codex",
      mark: "◎",
      color: "#F5F4E7",
      fontFamily: MONO_FONT,
    }
  }
  if (cliId === "gemini") {
    return {
      title: "Gemini",
      mark: "✦",
      color: "#8AB4F8",
      fontFamily: SANS_FONT,
    }
  }
  if (cliId === "research-core") {
    return {
      title: "Research Core",
      mark: "RC",
      color: "#D1FF00",
      fontFamily: MONO_FONT,
    }
  }
  return {
    title: OPENROUTER_CLI_LABEL,
    mark: "OR",
    color: "#F5F4E7",
    fontFamily: MONO_FONT,
  }
}

function formatElapsed(start: string, end: string) {
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) return "0s"
  const seconds = Math.round((endTime - startTime) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}m${String(rest).padStart(2, "0")}s`
}

function datedResearchSlug(baseSlug: string) {
  const match = baseSlug.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/)
  if (match) return `${match[1]}-${truncateSlug(match[2] ?? "", MAX_RESEARCH_TOPIC_SLUG_LENGTH) || "research-run"}`
  const compactSlug = truncateSlug(baseSlug, MAX_RESEARCH_TOPIC_SLUG_LENGTH)
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}-${compactSlug || "research-run"}`
}

function truncateSlug(slug: string, maxLength: number) {
  if (slug.length <= maxLength) return slug
  const parts = slug.split("-")
  const kept: string[] = []
  for (const part of parts) {
    const next = [...kept, part].join("-")
    if (next.length > maxLength) break
    kept.push(part)
  }
  return kept.length > 0 ? kept.join("-") : slug.slice(0, maxLength).replace(/-+$/g, "")
}

async function fetchRunState(runId: string) {
  const response = await fetch(`/api/research/runs/${encodeURIComponent(runId)}`, { cache: "no-store" })
  if (!response.ok) return null
  return (await response.json()) as ResearchRunState
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function uniqueCliIds(values: ResearchCliId[]) {
  return Array.from(new Set(values))
}

function preferredCli(clis: ResearchCliStatus[]) {
  return (
    clis.find((cli) => cli.available && cli.launchSupported && cli.id === "claude") ??
    clis.find((cli) => cli.available && cli.launchSupported) ??
    clis[0]
  )
}
