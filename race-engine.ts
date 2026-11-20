export const WIDTH = 800
export const HEIGHT = 500
export const TRIAL_DISTANCE = 1500
const STAGE_LENGTH = 1500

const ROAD_W = 360
const ROAD_X = (WIDTH - ROAD_W) / 2
const LANES = 4
const LANE_W = ROAD_W / LANES

const TRAFFIC_COLORS = ['#f97316', '#a3e635', '#facc15', '#e879f9', '#f43f5e', '#60a5fa']
const PLAYER_COLOR = '#22d3ee'
const EDGE_LEFT = '#ff3ea5'
const EDGE_RIGHT = '#22d3ee'

export type Input = { keys: Set<string>; pointer: { x: number; y: number } | null }

type Vehicle = {
  x: number
  y: number
  w: number
  h: number
  speed: number
  color: string
  kind: 'car' | 'truck'
  passed: boolean
}
type Pickup = { x: number; y: number; kind: 'coin' | 'nitro' | 'heart' }
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string }

export type GameState = {
  player: { x: number; y: number; w: number; h: number; invuln: number }
  speed: number
  distance: number
  bonus: number
  score: number
  lives: number
  stage: number
  traffic: Vehicle[]
  pickups: Pickup[]
  particles: Particle[]
  roadOffset: number
  spawnTimer: number
  pickupTimer: number
  nitro: number
  shake: number
}

export function createGame(): GameState {
  return {
    player: { x: WIDTH / 2, y: HEIGHT - 80, w: 34, h: 60, invuln: 1 },
    speed: 280,
    distance: 0,
    bonus: 0,
    score: 0,
    lives: 3,
    stage: 1,
    traffic: [],
    pickups: [],
    particles: [],
    roadOffset: 0,
    spawnTimer: 1,
    pickupTimer: 2,
    nitro: 0,
    shake: 0,
  }
}

const laneCenter = (lane: number) => ROAD_X + LANE_W * lane + LANE_W / 2
const rand = (min: number, max: number) => min + Math.random() * (max - min)

function burst(game: GameState, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const s = rand(60, 260)
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.8), color })
  }
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 4 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 6
}

export function idle(game: GameState, dt: number) {
  game.roadOffset = (game.roadOffset + 200 * dt) % 80
}

export function step(game: GameState, input: Input, dt: number, unlocked: boolean): 'ok' | 'dead' | 'trial-over' {
  const { keys, pointer } = input
  const p = game.player

  const steer =
    (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0)
  if (steer !== 0) {
    p.x += steer * 340 * dt
  } else if (pointer) {
    p.x += (pointer.x - p.x) * Math.min(1, dt * 8)
  }
  p.x = Math.max(ROAD_X + p.w / 2 + 4, Math.min(ROAD_X + ROAD_W - p.w / 2 - 4, p.x))

  const minSpeed = 200 + game.stage * 20
  const maxSpeed = 480 + game.stage * 30
  const cruise = 300 + game.stage * 25
  const gas = keys.has('ArrowUp') || keys.has('w')
  const brake = keys.has('ArrowDown') || keys.has('s')
  const target = gas ? maxSpeed : brake ? minSpeed : cruise
  game.speed += (target - game.speed) * Math.min(1, dt * (brake ? 3 : 1.5))

  game.nitro = Math.max(0, game.nitro - dt)
  const effective = game.speed * (game.nitro > 0 ? 1.6 : 1)

  game.distance += (effective * dt) / 10
  game.roadOffset = (game.roadOffset + effective * dt) % 80
  game.stage = 1 + Math.floor(game.distance / STAGE_LENGTH)
  p.invuln = Math.max(0, p.invuln - dt)
  game.shake = Math.max(0, game.shake - dt)

  if (!unlocked && game.distance >= TRIAL_DISTANCE) {
    game.score = Math.floor(game.distance) + game.bonus
    game.traffic = []
    game.pickups = []
    return 'trial-over'
  }

  game.spawnTimer -= dt
  if (game.spawnTimer <= 0) {
    const lane = Math.floor(Math.random() * LANES)
    const truck = unlocked && game.stage > 1 && Math.random() < 0.25
    const h = truck ? 110 : 60
    const blocked = game.traffic.some((v) => Math.abs(v.x - laneCenter(lane)) < 10 && v.y < h + 40)
    if (!blocked) {
      game.traffic.push({
        x: laneCenter(lane),
        y: -h,
        w: truck ? 44 : 34,
        h,
        speed: truck ? rand(90, 140) : rand(120, 220),
        color: truck ? '#94a3b8' : TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
        kind: truck ? 'truck' : 'car',
        passed: false,
      })
    }
    game.spawnTimer = Math.max(0.35, rand(0.7, 1.2) - game.stage * 0.08)
  }

  game.pickupTimer -= dt
  if (game.pickupTimer <= 0) {
    const roll = Math.random()
    const kind: Pickup['kind'] = unlocked && roll < 0.12 ? 'nitro' : unlocked && roll < 0.17 ? 'heart' : 'coin'
    game.pickups.push({ x: laneCenter(Math.floor(Math.random() * LANES)), y: -20, kind })
    game.pickupTimer = rand(0.8, 1.6)
  }

  for (const v of game.traffic) {
    v.y += (effective - v.speed) * dt
    if (!v.passed && v.y - v.h / 2 > p.y + p.h / 2) {
      v.passed = true
      game.bonus += 10
    }
  }

  const smashing = game.nitro > 0
  for (let i = game.traffic.length - 1; i >= 0; i--) {
    const v = game.traffic[i]
    if (!overlaps(p, v)) continue
    if (smashing) {
      burst(game, v.x, v.y, v.color, 24)
      game.bonus += 50
      game.traffic.splice(i, 1)
      game.shake = 0.15
    } else if (p.invuln <= 0) {
      burst(game, (p.x + v.x) / 2, (p.y + v.y) / 2, '#fbbf24', 30)
      game.traffic.splice(i, 1)
      game.lives -= 1
      p.invuln = 2
      game.shake = 0.35
      game.speed = minSpeed
      if (game.lives <= 0) {
        game.score = Math.floor(game.distance) + game.bonus
        return 'dead'
      }
    }
  }
  game.traffic = game.traffic.filter((v) => v.y < HEIGHT + 150 && v.y > -300)

  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const k = game.pickups[i]
    k.y += effective * dt
    if (Math.abs(k.x - p.x) < 30 && Math.abs(k.y - p.y) < 40) {
      if (k.kind === 'coin') {
        game.bonus += 25
        burst(game, k.x, k.y, '#facc15', 10)
      } else if (k.kind === 'nitro') {
        game.nitro = 3
        burst(game, k.x, k.y, PLAYER_COLOR, 16)
      } else {
        game.lives = Math.min(5, game.lives + 1)
        burst(game, k.x, k.y, EDGE_LEFT, 16)
      }
      game.pickups.splice(i, 1)
    } else if (k.y > HEIGHT + 30) {
      game.pickups.splice(i, 1)
    }
  }

  if (game.nitro > 0 && Math.random() < 0.8) {
    game.particles.push({
      x: p.x + rand(-8, 8),
      y: p.y + p.h / 2,
      vx: rand(-30, 30),
      vy: rand(120, 220),
      life: rand(0.2, 0.4),
      color: Math.random() < 0.5 ? '#f97316' : PLAYER_COLOR,
    })
  }

  for (const pt of game.particles) {
    pt.x += pt.vx * dt
    pt.y += pt.vy * dt
    pt.life -= dt
  }
  game.particles = game.particles.filter((pt) => pt.life > 0)

  game.score = Math.floor(game.distance) + game.bonus
  return 'ok'
}

export const displaySpeed = (game: GameState) => Math.round((game.speed * (game.nitro > 0 ? 1.6 : 1)) / 3)

function drawCar(ctx: CanvasRenderingContext2D, v: { x: number; y: number; w: number; h: number; color: string }, glow: number) {
  const { w, h } = v
  ctx.save()
  ctx.translate(v.x, v.y)
  ctx.shadowColor = v.color
  ctx.shadowBlur = glow
  ctx.fillStyle = v.color
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, 9)
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(8, 6, 24, 0.85)'
  ctx.beginPath()
  ctx.roundRect(-w / 2 + 5, -h / 2 + 13, w - 10, h * 0.22, 4)
  ctx.fill()
  ctx.beginPath()
  ctx.roundRect(-w / 2 + 6, h / 2 - h * 0.3, w - 12, h * 0.14, 3)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fillRect(-2, -h / 2 + 4, 4, h - 8)

  ctx.fillStyle = '#fff8c4'
  ctx.fillRect(-w / 2 + 4, -h / 2 + 2, 7, 4)
  ctx.fillRect(w / 2 - 11, -h / 2 + 2, 7, 4)
  ctx.fillStyle = '#ff2d55'
  ctx.fillRect(-w / 2 + 4, h / 2 - 5, 7, 3)
  ctx.fillRect(w / 2 - 11, h / 2 - 5, 7, 3)
  ctx.restore()
}

function drawTruck(ctx: CanvasRenderingContext2D, v: Vehicle) {
  const { w, h } = v
  ctx.save()
  ctx.translate(v.x, v.y)
  ctx.fillStyle = '#e11d48'
  ctx.beginPath()
  ctx.roundRect(-w / 2 + 2, -h / 2, w - 4, 28, 6)
  ctx.fill()
  ctx.fillStyle = 'rgba(8, 6, 24, 0.85)'
  ctx.fillRect(-w / 2 + 6, -h / 2 + 6, w - 12, 9)
  ctx.fillStyle = v.color
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2 + 32, w, h - 32, 4)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  for (let y = -h / 2 + 46; y < h / 2 - 6; y += 14) {
    ctx.beginPath()
    ctx.moveTo(-w / 2 + 4, y)
    ctx.lineTo(w / 2 - 4, y)
    ctx.stroke()
  }
  ctx.fillStyle = '#ff2d55'
  ctx.fillRect(-w / 2 + 3, h / 2 - 4, 8, 3)
  ctx.fillRect(w / 2 - 11, h / 2 - 4, 8, 3)
  ctx.restore()
}

export function draw(ctx: CanvasRenderingContext2D, game: GameState) {
  ctx.save()
  if (game.shake > 0) ctx.translate(rand(-6, 6), rand(-6, 6))

  ctx.fillStyle = '#0b0716'
  ctx.fillRect(-10, -10, WIDTH + 20, HEIGHT + 20)

  ctx.strokeStyle = 'rgba(168, 85, 247, 0.18)'
  ctx.lineWidth = 1
  for (let y = -80 + game.roadOffset; y < HEIGHT; y += 40) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(ROAD_X - 20, y)
    ctx.moveTo(ROAD_X + ROAD_W + 20, y)
    ctx.lineTo(WIDTH, y)
    ctx.stroke()
  }

  for (let y = -80 + game.roadOffset; y < HEIGHT + 80; y += 160) {
    for (const side of [ROAD_X - 60, ROAD_X + ROAD_W + 60]) {
      ctx.fillStyle = 'rgba(255, 62, 165, 0.35)'
      ctx.fillRect(side - 3, y, 6, 6)
      ctx.shadowColor = EDGE_LEFT
      ctx.shadowBlur = 16
      ctx.fillStyle = '#fde68a'
      ctx.beginPath()
      ctx.arc(side, y, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  ctx.fillStyle = '#17132a'
  ctx.fillRect(ROAD_X, -10, ROAD_W, HEIGHT + 20)

  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  for (let lane = 1; lane < LANES; lane++) {
    const x = ROAD_X + lane * LANE_W - 2
    for (let y = -80 + game.roadOffset; y < HEIGHT; y += 80) ctx.fillRect(x, y, 4, 40)
  }

  ctx.shadowBlur = 14
  ctx.shadowColor = EDGE_LEFT
  ctx.fillStyle = EDGE_LEFT
  ctx.fillRect(ROAD_X - 4, -10, 4, HEIGHT + 20)
  ctx.shadowColor = EDGE_RIGHT
  ctx.fillStyle = EDGE_RIGHT
  ctx.fillRect(ROAD_X + ROAD_W, -10, 4, HEIGHT + 20)
  ctx.shadowBlur = 0

  for (const k of game.pickups) {
    ctx.save()
    ctx.translate(k.x, k.y)
    if (k.kind === 'coin') {
      ctx.shadowColor = '#facc15'
      ctx.shadowBlur = 14
      ctx.fillStyle = '#facc15'
      ctx.beginPath()
      ctx.arc(0, 0, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#a16207'
      ctx.fillRect(-2, -6, 4, 12)
    } else if (k.kind === 'nitro') {
      ctx.shadowColor = PLAYER_COLOR
      ctx.shadowBlur = 18
      ctx.fillStyle = PLAYER_COLOR
      ctx.beginPath()
      ctx.moveTo(3, -14)
      ctx.lineTo(-8, 2)
      ctx.lineTo(0, 2)
      ctx.lineTo(-3, 14)
      ctx.lineTo(8, -2)
      ctx.lineTo(0, -2)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.shadowColor = EDGE_LEFT
      ctx.shadowBlur = 18
      ctx.fillStyle = EDGE_LEFT
      ctx.beginPath()
      ctx.moveTo(0, 10)
      ctx.bezierCurveTo(-16, -2, -8, -14, 0, -5)
      ctx.bezierCurveTo(8, -14, 16, -2, 0, 10)
      ctx.fill()
    }
    ctx.restore()
  }

  for (const v of game.traffic) {
    if (v.kind === 'truck') drawTruck(ctx, v)
    else drawCar(ctx, v, 8)
  }

  const p = game.player
  const beam = ctx.createLinearGradient(0, p.y - p.h / 2, 0, p.y - p.h / 2 - 140)
  beam.addColorStop(0, 'rgba(254, 249, 195, 0.28)')
  beam.addColorStop(1, 'rgba(254, 249, 195, 0)')
  ctx.fillStyle = beam
  ctx.beginPath()
  ctx.moveTo(p.x - 14, p.y - p.h / 2)
  ctx.lineTo(p.x - 46, p.y - p.h / 2 - 140)
  ctx.lineTo(p.x + 46, p.y - p.h / 2 - 140)
  ctx.lineTo(p.x + 14, p.y - p.h / 2)
  ctx.closePath()
  ctx.fill()

  const blink = p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0
  if (!blink) drawCar(ctx, { ...p, color: game.nitro > 0 ? '#f0abfc' : PLAYER_COLOR }, game.nitro > 0 ? 34 : 20)

  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life * 1.6)
    ctx.fillStyle = pt.color
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4)
  }
  ctx.globalAlpha = 1

  ctx.restore()
}
