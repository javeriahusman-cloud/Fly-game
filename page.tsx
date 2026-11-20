import { NeonRushGame } from '@/components/neon-rush-game'

export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-2">
        <p className="font-display text-[10px] text-accent">ARCADE HIGHWAY RACER</p>
        <h1 className="font-display text-2xl leading-relaxed text-balance sm:text-4xl">
          NEON <span className="text-primary">RUSH</span>
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground text-pretty sm:text-base">
          Weave through midnight traffic at full throttle. Drive the first stretch for free, then unlock the endless
          highway for $10.
        </p>
      </header>
      <NeonRushGame />
    </main>
  )
}
