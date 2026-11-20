'use client'

import { useEffect, useRef, useState } from 'react'
import { Flag, Gauge, Heart, Lock, Play, RotateCcw, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Paywall } from '@/components/paywall'
import {
  HEIGHT,
  TRIAL_DISTANCE,
  WIDTH,
  createGame,
  displaySpeed,
  draw,
  idle,
  step,
  type GameState,
  type Input,
} from '@/lib/race-engine'

type Phase = 'menu' | 'playing' | 'paywall' | 'gameover'
type Hud = { score: number; lives: number; stage: number; speed: number; distance: number; nitro: boolean }

const RACE_PERKS = ['Endless highway with rising speed', 'Nitro boosts that smash traffic', 'Big rigs & extra-life pickups']
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's']

export function NeonRushGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<GameState>(createGame())
  const inputRef = useRef<Input>({ keys: new Set(), pointer: null })
  const phaseRef = useRef<Phase>('menu')
  const unlockedRef = useRef(false)

  const [phase, setPhaseState] = useState<Phase>('menu')
  const [unlocked, setUnlocked] = useState(false)
  const [hud, setHud] = useState<Hud>({ score: 0, lives: 3, stage: 1, speed: 0, distance: 0, nitro: false })
  const [best, setBest] = useState(0)

  const setPhase = (next: Phase) => {
    phaseRef.current = next
    setPhaseState(next)
  }

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()
    let lastHud = ''

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const game = gameRef.current

      if (phaseRef.current === 'playing') {
        const result = step(game, inputRef.current, dt, unlockedRef.current)
        if (result === 'dead') {
          setBest((b) => Math.max(b, game.score))
          setPhase('gameover')
        } else if (result === 'trial-over') {
          setPhase('paywall')
        }
      } else if (phaseRef.current === 'menu') {
        idle(game, dt)
      }

      draw(ctx, game)

      const next: Hud = {
        score: game.score,
        lives: game.lives,
        stage: game.stage,
        speed: phaseRef.current === 'playing' ? displaySpeed(game) : 0,
        distance: Math.floor(game.distance),
        nitro: game.nitro > 0,
      }
      const key = JSON.stringify(next)
      if (key !== lastHud) {
        lastHud = key
        setHud(next)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (phaseRef.current !== 'playing' || !GAME_KEYS.includes(e.key)) return
      e.preventDefault()
      inputRef.current.keys.add(e.key)
      inputRef.current.pointer = null
    }
    const up = (e: KeyboardEvent) => inputRef.current.keys.delete(e.key)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    inputRef.current.pointer = {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    }
  }

  const startNewGame = () => {
    gameRef.current = createGame()
    inputRef.current.keys.clear()
    inputRef.current.pointer = null
    setPhase('playing')
  }

  const handleUnlock = () => {
    unlockedRef.current = true
    setUnlocked(true)
    gameRef.current.player.invuln = 2
    setPhase('playing')
  }

  const trialProgress = Math.min(100, (hud.distance / TRIAL_DISTANCE) * 100)

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 font-display text-[10px] sm:text-xs">
        <div className="flex items-center gap-4">
          <span>
            <span className="text-muted-foreground">SCORE </span>
            <span className="text-primary">{hud.score.toString().padStart(5, '0')}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Gauge className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className={hud.nitro ? 'text-accent' : 'text-foreground'}>{hud.speed}</span>
            <span className="text-muted-foreground">KM/H</span>
          </span>
          <span>
            <span className="text-muted-foreground">STAGE </span>
            <span className="text-accent">{hud.stage}</span>
          </span>
        </div>
        <div className="flex items-center gap-1" aria-label={`${hud.lives} lives remaining`}>
          {Array.from({ length: Math.max(0, hud.lives) }).map((_, i) => (
            <Heart key={i} className="size-4 fill-accent text-accent" aria-hidden="true" />
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-primary/40 shadow-[0_0_40px_-10px] shadow-primary/40">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          className="block aspect-[8/5] w-full touch-none"
          aria-label="Neon Rush highway racing game"
          role="img"
        />

        {phase === 'menu' && (
          <Overlay>
            <h2 className="font-display text-xl leading-relaxed text-primary text-balance sm:text-3xl">NEON RUSH</h2>
            <p className="max-w-sm text-sm text-muted-foreground text-pretty">
              Steer with left/right (or A/D, mouse, finger). Hold up to floor it, down to brake. Dodge traffic and
              grab coins. The first {TRIAL_DISTANCE.toLocaleString()} m are free.
            </p>
            <Button size="lg" onClick={startNewGame} className="font-display text-xs">
              <Play className="size-4" aria-hidden="true" />
              DRIVE FREE
            </Button>
          </Overlay>
        )}

        {phase === 'paywall' && (
          <Paywall
            eyebrow={`TRIAL FINISHED \u00b7 ${hud.score} PTS`}
            title="UNLOCK THE OPEN ROAD"
            perks={RACE_PERKS}
            onUnlock={handleUnlock}
          />
        )}

        {phase === 'gameover' && (
          <Overlay>
            <h2 className="font-display text-xl text-accent sm:text-2xl">WRECKED</h2>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="size-4 text-primary" aria-hidden="true" />
              {hud.distance} m &middot; Score {hud.score} &middot; Best {best}
            </p>
            <Button size="lg" onClick={startNewGame} className="font-display text-xs">
              <RotateCcw className="size-4" aria-hidden="true" />
              RACE AGAIN
            </Button>
          </Overlay>
        )}
      </div>

      {unlocked ? (
        <p className="text-xs text-primary">Full game unlocked: endless highway, nitro, big rigs, and extra lives.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <Lock className="size-3.5" aria-hidden="true" />
              Free trial: first {TRIAL_DISTANCE.toLocaleString()} m. Unlock the full game for $10.
            </span>
            <span className="flex items-center gap-1 font-display text-[10px]">
              <Flag className="size-3.5" aria-hidden="true" />
              {hud.distance}/{TRIAL_DISTANCE}
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-label="Free trial progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(trialProgress)}
          >
            <div className="h-full bg-primary transition-[width]" style={{ width: `${trialProgress}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/75 p-6 text-center backdrop-blur-sm">
      {children}
    </div>
  )
}
