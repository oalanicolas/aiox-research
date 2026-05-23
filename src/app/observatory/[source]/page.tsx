import { Suspense } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { Observatory } from "@/components/observatory/observatory"
import {
  EmptyObservatorySourceError,
  getAvailableObservatorySources,
  getObservatoryData,
  isObservatorySourceAvailable,
  type ObservatorySource,
} from "@/lib/observatory.server"
import type { ObservatoryData, ReaderMode } from "@/components/observatory/foundations/types"

const VALID_SOURCES: ObservatorySource[] = ["research", "bench", "sinkra-maps", "demo"]

const SOURCE_TITLES: Partial<Record<ObservatorySource, string>> = {
  research: "Research · AIOX Research",
  bench: "Bench · AIOX Research",
  "sinkra-maps": "SINKRA Maps · AIOX Research",
  demo: "Demo · AIOX Research",
}

const SOURCE_DESCRIPTIONS: Partial<Record<ObservatorySource, string>> = {
  research: "Operational reader for docs/research artifacts.",
  bench: "Comparative benchmark dashboards with matrix, personas and TCO.",
  "sinkra-maps": "Structured dashboards for outputs/sinkra-squad maps, workflows, automation and governance.",
  demo: "Complete sample Observatory with benchmark, slides, roadmap and evidence.",
}

export const dynamic = "force-dynamic"

type ObservatoryPageProps = {
  params: Promise<{ source: string }>
  searchParams?: Promise<{
    slug?: string
    file?: string
    view?: string
    sort?: string
    status?: string
    group?: string
  }>
}

export async function generateMetadata({ params, searchParams }: ObservatoryPageProps): Promise<Metadata> {
  const { source } = await params
  if (!VALID_SOURCES.includes(source as ObservatorySource)) {
    return { title: "AIOX Research" }
  }
  const key = source as ObservatorySource
  const baseTitle = SOURCE_TITLES[key] ?? "AIOX Research"
  const description = SOURCE_DESCRIPTIONS[key]

  const sp = searchParams ? await searchParams : undefined
  if (sp?.slug) {
    try {
      const result = await getObservatoryData({ source: key, slug: sp.slug })
      const run = result.data.selectedRun
      if (run?.displayTitle) {
        return { title: `${run.displayTitle} · AIOX Research`, description }
      }
    } catch {
      // Slug missing or fetch failed — fall back to source-level title.
    }
  }

  return { title: baseTitle, description }
}

// Inline deploy-mode guard — bypass any module-state cache that might serve
// pre-filter results in stale warm lambdas.
const REMOTE_HIDDEN_SOURCES: ReadonlySet<ObservatorySource> = new Set(["sinkra-maps", "demo"])

function isRemoteDeployMode(): boolean {
  return (
    process.env.DEPLOY_MODE?.trim().toLowerCase() === "remote" ||
    process.env.VERCEL === "1"
  )
}

export default async function ObservatoryPage({ params, searchParams }: ObservatoryPageProps) {
  const { source } = await params
  const key = source as ObservatorySource
  if (!VALID_SOURCES.includes(key)) notFound()
  if (isRemoteDeployMode() && REMOTE_HIDDEN_SOURCES.has(key)) notFound()
  if (!isObservatorySourceAvailable(key)) notFound()
  const sp = await searchParams
  const availableSources = getAvailableObservatorySources()
  let data: ObservatoryData
  try {
    const result = await getObservatoryData({
      source: source as ObservatorySource,
      slug: sp?.slug,
      file: sp?.file,
      view: sp?.view as ReaderMode | undefined,
    })
    data = result.data
  } catch (error) {
    if (error instanceof EmptyObservatorySourceError) notFound()
    throw error
  }

  return (
    <div>
      <Suspense fallback={null}>
        <Observatory data={data} availableSources={availableSources} basePath="/observatory" />
      </Suspense>
    </div>
  )
}
