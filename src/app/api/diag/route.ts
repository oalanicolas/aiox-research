import { NextResponse } from "next/server"
import { getAvailableObservatorySources } from "@/lib/observatory.server"
import { debugResolvedRoot } from "@/lib/workspace-root.server"

// Temporary diagnostic endpoint — verify env + filter resolution in lambda.
// Remove after sinkra-maps/demo hide is confirmed working in prod.

export const dynamic = "force-dynamic"

export async function GET() {
  let sources: unknown
  let error: string | null = null
  try {
    sources = getAvailableObservatorySources().map(([s]) => s)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({
    env: {
      VERCEL: process.env.VERCEL ?? null,
      DEPLOY_MODE: process.env.DEPLOY_MODE ?? null,
      NODE_ENV: process.env.NODE_ENV ?? null,
      VERCEL_ENV: process.env.VERCEL_ENV ?? null,
    },
    workspace: debugResolvedRoot(),
    sources,
    error,
    deploymentTimestamp: new Date().toISOString(),
  })
}
