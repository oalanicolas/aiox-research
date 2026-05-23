import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Hide internal-only observatory sources from the public deployment.
 *
 * Edge middleware runs ahead of any page or route handler, so it is the
 * earliest opportunity to short-circuit unwanted paths. Local dev keeps the
 * sources visible (no VERCEL / DEPLOY_MODE).
 */

const HIDDEN_PATHS = ["/observatory/sinkra-maps", "/observatory/demo"]

function isRemoteDeployMode(): boolean {
  return (
    process.env.DEPLOY_MODE?.trim().toLowerCase() === "remote" ||
    process.env.VERCEL === "1"
  )
}

export function middleware(request: NextRequest) {
  if (!isRemoteDeployMode()) return NextResponse.next()

  const pathname = request.nextUrl.pathname
  const blocked = HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (blocked) {
    return new NextResponse(null, { status: 404 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/observatory/:path*"],
}
