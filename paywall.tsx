import { Check, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PaywallProps = { eyebrow: string; title: string; perks: string[]; onUnlock: () => void }

export function Paywall({ eyebrow, title, perks, onUnlock }: PaywallProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      className="absolute inset-0 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-accent/50 bg-card p-5 text-center shadow-[0_0_40px_-8px] shadow-accent/50">
        <p className="font-display text-[10px] text-primary">{eyebrow}</p>
        <h2 id="paywall-title" className="font-display text-base leading-relaxed text-balance sm:text-lg">
          {title}
        </h2>
        <ul className="flex flex-col gap-1.5 text-left text-sm">
          {perks.map((perk) => (
            <li key={perk} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {perk}
            </li>
          ))}
        </ul>
        <p className="font-display text-2xl text-accent">$10</p>
        <Button size="lg" onClick={onUnlock} className="font-display text-xs">
          <Unlock className="size-4" aria-hidden="true" />
          BUY & KEEP PLAYING
        </Button>
        <p className="text-xs text-muted-foreground text-pretty">
          Demo mode: payments are not connected yet, so no card is charged. Connect Stripe to accept real
          payments.
        </p>
      </div>
    </div>
  )
}
