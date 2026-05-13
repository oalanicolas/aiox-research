import { redirect } from "next/navigation"
import { getAvailableObservatorySources } from "@/lib/observatory.server"
import { MONO_FONT, SANS_FONT, observatoryThemeVars } from "@/components/observatory/foundations/theme"

export const dynamic = "force-dynamic"

export default function ObservatoryRootPage() {
  const availableSources = getAvailableObservatorySources()
  const firstSource = availableSources[0]?.[0]
  if (firstSource) redirect(`/observatory/${firstSource}`)

  return (
    <main
      className="grid min-h-screen place-items-center bg-[var(--paper)] px-6 text-[var(--ink)]"
      style={{ ...observatoryThemeVars, fontFamily: SANS_FONT }}
    >
      <section className="max-w-[560px] border border-[var(--rule)] bg-[var(--paper-alt)] p-8">
        <p className="mb-3 text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]" style={{ fontFamily: MONO_FONT }}>
          AIOX Dash
        </p>
        <h1 className="text-[28px] font-black tracking-[-0.04em]">Nenhuma fonte encontrada</h1>
        <p className="mt-3 text-[14px] leading-[1.6] text-[var(--ink-2)]">
          Crie pelo menos uma destas pastas para habilitar os menus do Observatory:
          <code className="mx-1 font-mono">docs/research</code>,
          <code className="mx-1 font-mono">docs/bench</code> ou
          <code className="mx-1 font-mono">outputs/sinkra-squad</code>.
        </p>
      </section>
    </main>
  )
}
