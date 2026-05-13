import { Suspense } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { Observatory } from "@/components/observatory/observatory"
import {
  getAvailableObservatorySources,
  getObservatoryData,
  isObservatorySourceAvailable,
  type ObservatorySource,
} from "@/lib/observatory.server"

const VALID_SOURCES: ObservatorySource[] = ["research", "bench", "sinkra-maps"]

const SOURCE_TITLES: Partial<Record<ObservatorySource, string>> = {
  research: "Research · AIOX Dash",
  bench: "Bench · AIOX Dash",
  "sinkra-maps": "SINKRA Maps · AIOX Dash",
}

const SOURCE_DESCRIPTIONS: Partial<Record<ObservatorySource, string>> = {
  research: "Operational reader for docs/research artifacts.",
  bench: "Comparative benchmark dashboards with matrix, personas and TCO.",
  "sinkra-maps": "Structured dashboards for outputs/sinkra-squad maps, workflows, automation and governance.",
}

export const dynamic = "force-dynamic"

type ObservatoryPageProps = {
  params: Promise<{ source: string }>
  searchParams?: Promise<{
    slug?: string
    file?: string
    sort?: string
    status?: string
    group?: string
  }>
}

export async function generateMetadata({ params }: ObservatoryPageProps): Promise<Metadata> {
  const { source } = await params
  if (!VALID_SOURCES.includes(source as ObservatorySource)) {
    return { title: "AIOX Dash" }
  }
  const key = source as ObservatorySource
  return {
    title: SOURCE_TITLES[key] ?? "AIOX Dash",
    description: SOURCE_DESCRIPTIONS[key],
  }
}

export default async function ObservatoryPage({ params, searchParams }: ObservatoryPageProps) {
  const { source } = await params
  if (!VALID_SOURCES.includes(source as ObservatorySource) || !isObservatorySourceAvailable(source as ObservatorySource)) {
    notFound()
  }
  const sp = await searchParams
  const availableSources = getAvailableObservatorySources()
  const { data } = await getObservatoryData({
    source: source as ObservatorySource,
    slug: sp?.slug,
    file: sp?.file,
  })

  return (
    <div>
      <Suspense fallback={null}>
        <Observatory data={data} availableSources={availableSources} basePath="/observatory" />
      </Suspense>
    </div>
  )
}
