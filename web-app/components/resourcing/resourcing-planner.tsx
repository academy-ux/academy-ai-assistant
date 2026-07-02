'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

/* Academy — Resourcing planner (daily Mon–Fri Gantt).
   Solid = Harvest actuals · dashed = projection · ringed = planned · dark = time off.
   Ported from the reference build; data comes from /api/resourcing/schedule and
   planner edits persist via PUT /api/resourcing/planner (debounced, replace-all). */

export interface ScheduleData {
  people: Record<string, { cap: number; role: string; days: Record<string, Record<string, number>> }>
  clients: string[]
  burned: Record<string, number>
  starts: Record<string, string>
  lastActual: string
  syncedAt: string
  planner: {
    plans: Booking[]
    timeoff: Timeoff[]
    budgets: Record<string, number>
    capOverrides: Record<string, number>
  }
}

interface Booking { id: string; name: string; client: string; hrs: number; start: string; end: string }
// weekdays (0-4 = Mon..Fri) set → repeats weekly from start until end (no end when null)
interface Timeoff { id: string; name: string; start: string; end?: string | null; weekdays?: number[] | null }
const WD_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

// Academy design tokens (globals.css) mapped onto the planner surface.
const C = {
  panel: '#FFFFFF',
  ink: '#272727', // charcoal
  ink2: '#4b4d44',
  muted: '#767871',
  line: '#c5c9b8', // medium-dark-olive
  line2: '#dfe1d8',
  grid: '#e9ebe3',
  gridWk: '#c5c9b8',
  accent: '#8f917f', // darkest-green (primary)
  pos: '#4a9c68', // success
  neg: '#d24141', // destructive
  gold: '#d97b33', // warning
  off: '#272727', // time off = charcoal
}
const SANS = "'neue-haas-grotesk-display','SF Pro Display',system-ui,sans-serif"

// Client bar colors — muted earth tones tuned to the Academy olive/charcoal/
// peach palette (similar saturation + lightness so white bar text stays
// readable); unknown clients cycle the palette.
const CLR: Record<string, string> = {
  Superhuman: '#7A8B68', Klarity: '#5E8578', 'G&CO': '#B08E4F', 'Big Human': '#8B7A93',
  'Samsara AI': '#647E8C', 'Samsara DS': '#87999F', Clerky: '#B37E63', DEXScreener: '#8A6F3D',
  DeepMind: '#5C6E85', Academy: '#A4A794',
}
const FALLBACK = ['#7A8B68', '#8B7A93', '#B08E4F', '#647E8C', '#B37E63', '#5C6E85', '#5E8578', '#8A6F3D']
const clientColor = (client: string) => {
  if (CLR[client]) return CLR[client]
  let h = 0
  for (let i = 0; i < client.length; i++) h = (h * 31 + client.charCodeAt(i)) >>> 0
  return FALLBACK[h % FALLBACK.length]
}
const clientOf = (l: string) => l.split(' · ')[0]

const MS_DAY = 86400000
const DOW = ['M', 'T', 'W', 'T', 'F']
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const mondayOf = (d: Date) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x }
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * MS_DAY)
const addWeeks = (d: Date, n: number) => addDays(d, n * 7)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parseKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
const dLabel = (key: string) => parseKey(key).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const isoWeek = (d: Date) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3); const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); return 1 + Math.round(((t.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7) }

interface DayCol { date: Date; key: string; dow: number; weekIdx: number; dayNum: number; projected: boolean; isToday: boolean }

const buildDays = (anchorMon: Date, weeksN: number, todayKey: string, lastActual: string) => {
  const days: DayCol[] = []
  const weeks: { ww: number; label: string; start: number }[] = []
  for (let w = 0; w < weeksN; w++) {
    const wkMon = addWeeks(anchorMon, w)
    weeks.push({ ww: isoWeek(wkMon), label: wkMon.toLocaleString('en-US', { month: 'short', day: 'numeric' }), start: w * 5 })
    for (let k = 0; k < 5; k++) {
      const d = addDays(wkMon, k)
      const key = ymd(d)
      days.push({ date: d, key, dow: k, weekIdx: w, dayNum: d.getDate(), projected: key > lastActual, isToday: key === todayKey })
    }
  }
  return { days, weeks }
}

const mergeSegs = (arr: ({ h: number; variant: string } | null)[]) => {
  const segs: { s: number; e: number; hrs: number; variant: string }[] = []
  let i = 0
  const n = arr.length
  while (i < n) {
    const w = arr[i]
    if (w && w.h > 0) {
      const v = w.variant
      let j = i, sum = 0, c = 0
      while (j < n) { const x = arr[j]; if (x && x.h > 0 && x.variant === v) { sum += x.h; c++; j++ } else break }
      segs.push({ s: i, e: j - 1, hrs: sum / c, variant: v })
      i = j
    } else i++
  }
  return segs
}

const LEFT = 250
const BARH = 20, GAP = 3, PADV = 6
const navBtn: React.CSSProperties = { width: 30, height: 28, border: `1px solid ${C.line}`, borderRadius: 7, background: '#fff', cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 600, lineHeight: 1, color: C.ink2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }
const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.ink2} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><polyline points={dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} /></svg>)
const pill = (activeVal: unknown, val: unknown): React.CSSProperties => ({ border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 11.5, fontWeight: 600, padding: '5px 12px', borderRadius: 6, background: activeVal === val ? '#fff' : 'transparent', color: activeVal === val ? C.ink : C.muted, boxShadow: activeVal === val ? '0 1px 2px rgba(0,0,0,.08)' : 'none' })
const gridBg = (n: number) => `repeating-linear-gradient(90deg, transparent, transparent calc(100%/${n} - 1px), ${C.grid} calc(100%/${n} - 1px), ${C.grid} calc(100%/${n})), repeating-linear-gradient(90deg, ${C.gridWk} 0, ${C.gridWk} 1px, transparent 1px, transparent calc(500%/${n}))`

type FormState = {
  type: 'booking' | 'timeoff'
  editing?: string | null
  name: string
  client?: string
  hrs?: number | string
  start: string
  end: string // '' = no end date (recurring only)
  repeat?: 'once' | 'weekly'
  weekdays?: number[]
  all: boolean
} | null

type DragState = {
  mode: 'create' | 'move' | 'resizeL' | 'resizeR'
  kind?: 'plan' | 'off'
  id?: string
  name?: string
  aIdx?: number
  bIdx?: number
  grabIdx?: number
  origStart?: string
  origEnd?: string
  recurring?: boolean
  rectLeft: number
  colW: number
  moved?: boolean
} | null

export default function ResourcingPlanner({ data, onResync }: { data: ScheduleData; onResync: () => Promise<void> }) {
  const DD = data.people
  const NAMES = useMemo(() => Object.keys(DD), [DD])
  const CLIENTS = useMemo(() => {
    const s = new Set([...data.clients, ...data.planner.plans.map((p) => p.client)])
    return [...s].sort()
  }, [data.clients, data.planner.plans])
  const LAST_ACTUAL = data.lastActual
  const BURNED = data.burned
  const PSTART = data.starts

  const [view, setView] = useState<'team' | 'projects'>('team')
  const [caps, setCaps] = useState<Record<string, number>>(() =>
    Object.fromEntries(NAMES.map((n) => [n, data.planner.capOverrides[n] ?? DD[n].cap]))
  )
  const [editCap, setEditCap] = useState(false)
  const [planMode, setPlanMode] = useState(false)
  const [plans, setPlans] = useState<Booking[]>(data.planner.plans)
  const [timeoff, setTimeoff] = useState<Timeoff[]>(data.planner.timeoff)
  const [form, setForm] = useState<FormState>(null)
  const [drag, setDrag] = useState<DragState>(null)
  const dragRef = useRef<DragState>(null)
  const [past, setPast] = useState<{ plans: Booking[]; timeoff: Timeoff[] }[]>([])
  const [future, setFuture] = useState<{ plans: Booking[]; timeoff: Timeoff[] }[]>([])
  const [budgets, setBudgets] = useState<Record<string, number>>(data.planner.budgets)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [syncing, setSyncing] = useState(false)

  const setBudget = (lab: string, v: string) => setBudgets((b) => {
    const n = Math.max(0, Number(v) || 0)
    const next = { ...b }
    if (n > 0) next[lab] = n
    else delete next[lab]
    return next
  })
  const bizDays = (a: string, b: string) => { let n = 0, d = parseKey(a); const e = parseKey(b); while (d <= e) { const w = d.getDay(); if (w >= 1 && w <= 5) n++; d = addDays(d, 1) } return n }
  const setCap = (n: string, v: string) => setCaps((c) => ({ ...c, [n]: clamp(Number(v) || 0, 0, 80) }))
  const edited = NAMES.some((n) => caps[n] !== DD[n].cap)

  // ---- persistence: debounced replace-all save of planner state ----
  // Saves are chained so two in-flight PUTs can never interleave server-side.
  const firstRender = useRef(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveChain = useRef<Promise<void>>(Promise.resolve())
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    setSaveState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const capOverrides = Object.fromEntries(
        NAMES.filter((n) => caps[n] != null && caps[n] !== DD[n].cap).map((n) => [n, caps[n]])
      )
      const body = JSON.stringify({ plans, timeoff, budgets, capOverrides })
      saveChain.current = saveChain.current.then(async () => {
        try {
          const res = await fetch('/api/resourcing/planner', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body,
          })
          if (!res.ok) throw new Error(await res.text())
          setSaveState('saved')
        } catch (e) {
          console.error('[resourcing] save failed', e)
          setSaveState('error')
        }
      })
    }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, timeoff, budgets, caps])

  // ---- undo/redo history ----
  const plansRef = useRef(plans); plansRef.current = plans
  const timeoffRef = useRef(timeoff); timeoffRef.current = timeoff
  const pastRef = useRef(past); pastRef.current = past
  const futureRef = useRef(future); futureRef.current = future
  const snapshot = () => ({ plans: plansRef.current, timeoff: timeoffRef.current })
  const pushHist = () => { setPast((p) => [...p, snapshot()]); setFuture([]) }
  const popHist = () => setPast((p) => p.slice(0, -1))
  const undo = () => { const pa = pastRef.current; if (!pa.length) return; const prev = pa[pa.length - 1]; setFuture((f) => [...f, snapshot()]); setPast(pa.slice(0, -1)); setPlans(prev.plans); setTimeoff(prev.timeoff) }
  const redo = () => { const fu = futureRef.current; if (!fu.length) return; const nxt = fu[fu.length - 1]; setPast((p) => [...p, snapshot()]); setFuture(fu.slice(0, -1)); setPlans(nxt.plans); setTimeoff(nxt.timeoff) }
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const z = e.key === 'z' || e.key === 'Z'
      if ((e.metaKey || e.ctrlKey) && z) { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', kd)
    return () => window.removeEventListener('keydown', kd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const NOW = new Date()
  const todayKey = ymd(NOW)
  const [weeksN, setWeeksN] = useState(1)
  const [anchor, setAnchor] = useState(() => mondayOf(NOW))
  const { days: DAYS, weeks: WKS } = buildDays(anchor, weeksN, todayKey, LAST_ACTUAL)
  const NC = DAYS.length
  const todayIdx = DAYS.findIndex((d) => d.isToday)
  const shift = (n: number) => setAnchor((a) => addWeeks(a, n))
  const jumpToday = () => setAnchor(addWeeks(mondayOf(NOW), -Math.floor(weeksN / 2)))

  let horizon: string[] = []
  { let m = addWeeks(mondayOf(NOW), -3); for (let i = 0; i < 14; i++) { for (let k = 0; k < 5; k++) horizon.push(ymd(addDays(m, k))); m = addWeeks(m, 1) } }
  DAYS.forEach((d) => { if (!horizon.includes(d.key)) horizon.push(d.key) })
  horizon = [...new Set(horizon)].sort()

  const trailAvg = (name: string) => {
    const dd = DD[name].days
    const keys = Object.keys(dd).filter((k) => k <= LAST_ACTUAL).sort().slice(-10)
    if (!keys.length) return null
    let t = 0
    const p: Record<string, number> = {}
    keys.forEach((k) => { for (const [l, h] of Object.entries(dd[k])) { p[l] = (p[l] || 0) + h; t += h } })
    t /= keys.length
    for (const l in p) { p[l] /= keys.length; if (p[l] < 0.5) delete p[l] }
    return { t, p }
  }

  // Weekly capacity is spread over the person's working days: 5 minus any
  // recurring-off weekdays (part-timers), so a 32h cap on a Mon–Thu schedule
  // means 8h/day — not 6.4h/day with Fridays double-counted as lost capacity.
  const workdaysPerWeek = (name: string) => {
    const wds = new Set<number>()
    timeoff.forEach((o) => {
      if (o.name === name && o.weekdays?.length && o.start <= DAYS[NC - 1].key && (!o.end || o.end >= DAYS[0].key)) o.weekdays.forEach((d) => wds.add(d))
    })
    return Math.max(1, 5 - wds.size)
  }
  // ?? fallback: a resync can introduce a person who wasn't in the initial caps state
  const capDay = (name: string) => (caps[name] ?? DD[name].cap) / workdaysPerWeek(name)
  const offMatches = (o: Timeoff, day: DayCol) =>
    o.weekdays?.length
      ? o.weekdays.includes(day.dow) && day.key >= o.start && (!o.end || day.key <= o.end)
      : day.key >= o.start && day.key <= (o.end || o.start)
  const getCell = (name: string, day: DayCol): { off?: boolean; variant: string; t: number; p: Record<string, number> } | null => {
    if (timeoff.some((o) => o.name === name && offMatches(o, day))) return { off: true, variant: 'off', t: 0, p: {} }
    const dd = DD[name].days
    if (dd[day.key]) { const p = dd[day.key]; return { p, t: Object.values(p).reduce((a, b) => a + b, 0), variant: 'actual' } }
    const pl = plans.filter((b) => b.name === name && day.key >= b.start && day.key <= b.end)
    if (pl.length) { const p: Record<string, number> = {}; let t = 0; pl.forEach((b) => { const l = b.client + ' · planned'; p[l] = (p[l] || 0) + b.hrs; t += b.hrs }); return { t, p, variant: 'planned' } }
    if (day.projected) { const a = trailAvg(name); if (a && a.t > 0.4) return { ...a, variant: 'projected' } }
    return null
  }
  // Utilization vs weekly capacity: total hours across the visible window ÷
  // (daily cap × weekdays in window). Days with nothing logged count as 0;
  // time-off days are removed from capacity.
  const winUtil = (name: string) => {
    const cd0 = capDay(name)
    if (cd0 <= 0) return null
    let hours = 0, days = 0
    DAYS.forEach((day) => {
      const cd = getCell(name, day)
      if (cd?.off) return
      days++
      hours += cd ? cd.t : 0
    })
    return days ? Math.round((hours / (cd0 * days)) * 100) : null
  }
  const packLanes = (items: any[]) => { items.sort((a, b) => a.s - b.s || (a.kind === 'off' ? -1 : 1)); const lanes: number[] = []; items.forEach((it) => { let placed = false; for (let L = 0; L < lanes.length; L++) { if (it.s > lanes[L]) { lanes[L] = it.e; it.lane = L; placed = true; break } } if (!placed) { it.lane = lanes.length; lanes.push(it.e) } }); return Math.max(1, lanes.length) }

  const setItem = (d: NonNullable<DragState>, updater: (x: any) => any) => {
    if (d.kind === 'off') setTimeoff((t) => t.map((x) => (x.id === d.id ? updater(x) : x)))
    else setPlans((p) => p.map((x) => (x.id === d.id ? updater(x) : x)))
  }
  const beginDrag = (e: React.MouseEvent, name: string) => {
    if (!planMode) return
    const r = e.currentTarget.getBoundingClientRect()
    const colW = r.width / NC
    const idx = clamp(Math.floor((e.clientX - r.left) / colW), 0, NC - 1)
    const ds = (e.target as HTMLElement).dataset || {}
    e.preventDefault()
    let d: DragState
    if (ds.handle) {
      d = { mode: ds.handle === 'M' ? 'move' : ds.handle === 'L' ? 'resizeL' : 'resizeR', kind: ds.kind as 'plan' | 'off', id: ds.id, grabIdx: idx, origStart: ds.start, origEnd: ds.end, recurring: ds.recurring === '1', rectLeft: r.left, colW, moved: false }
      pushHist()
    } else d = { mode: 'create', name, aIdx: idx, bIdx: idx, rectLeft: r.left, colW }
    dragRef.current = d
    setDrag(d)
  }
  const openEdit = (kind: 'plan' | 'off', id: string) => {
    if (kind === 'off') { const o = timeoffRef.current.find((x) => x.id === id); if (o) setForm({ type: 'timeoff', editing: id, name: o.name, start: o.start, end: o.end || '', repeat: o.weekdays?.length ? 'weekly' : 'once', weekdays: o.weekdays || [], all: false }) }
    else { const b = plansRef.current.find((x) => x.id === id); if (b) setForm({ type: 'booking', editing: id, name: b.name, client: b.client, hrs: b.hrs, start: b.start, end: b.end, all: false }) }
  }
  useEffect(() => {
    const mm = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const idx = clamp(Math.floor((e.clientX - d.rectLeft) / d.colW), 0, NC - 1)
      if (d.recurring) return // recurring rules edit via dialog only, never by drag
      if (d.mode === 'create') { if (idx !== d.bIdx) { d.bIdx = idx; setDrag({ ...d }) } }
      else if (d.mode === 'resizeL') { if (idx !== d.grabIdx) d.moved = true; const key = DAYS[idx].key; setItem(d, (it) => (key <= it.end ? { ...it, start: key } : it)) }
      else if (d.mode === 'resizeR') { if (idx !== d.grabIdx) d.moved = true; const key = DAYS[idx].key; setItem(d, (it) => (key >= it.start ? { ...it, end: key } : it)) }
      else if (d.mode === 'move') { if (idx !== d.grabIdx) d.moved = true; const delta = idx - (d.grabIdx || 0); const ns = DAYS[clamp(DAYS.findIndex((x) => x.key === d.origStart) + delta, 0, NC - 1)], ne = DAYS[clamp(DAYS.findIndex((x) => x.key === d.origEnd) + delta, 0, NC - 1)]; if (ns && ne) setItem(d, (it) => ({ ...it, start: ns.key, end: ne.key })) }
    }
    const mu = () => {
      const d = dragRef.current
      if (!d) return
      if (d.mode === 'create') { const a = Math.min(d.aIdx!, d.bIdx!), b = Math.max(d.aIdx!, d.bIdx!); setForm({ type: 'booking', name: d.name!, client: CLIENTS[0], hrs: 8, start: DAYS[a].key, end: DAYS[b].key, repeat: 'once', weekdays: [], all: false }) }
      else if (!d.moved) { popHist(); openEdit(d.kind!, d.id!) } // click without drag = edit
      dragRef.current = null
      setDrag(null)
    }
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', mu)
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu) }
  })

  const weekly = form?.type === 'timeoff' && form.repeat === 'weekly'
  const canSubmit = !weekly || (form?.weekdays?.length ?? 0) > 0
  const submitForm = () => {
    if (!form || !canSubmit) return
    const s = form.start, e = form.end >= form.start ? form.end : form.start
    // recurring: end is optional ('' = repeats forever), weekdays drive the days
    const offFields = weekly
      ? { start: s, end: form.end && form.end >= s ? form.end : null, weekdays: form.weekdays! }
      : { start: s, end: e, weekdays: null }
    pushHist()
    if (form.editing != null) {
      if (form.type === 'timeoff') setTimeoff((t) => t.map((x) => (x.id === form.editing ? { ...x, name: form.name, ...offFields } : x)))
      else setPlans((p) => p.map((x) => (x.id === form.editing ? { ...x, name: form.name, client: form.client!, hrs: clamp(Number(form.hrs) || 0, 0, 16), start: s, end: e } : x)))
    } else if (form.type === 'timeoff') { const targets = form.all ? NAMES : [form.name]; setTimeoff((t) => [...t, ...targets.map((n) => ({ id: crypto.randomUUID(), name: n, ...offFields }))]) }
    else setPlans((p) => [...p, { id: crypto.randomUUID(), name: form.name, client: form.client!, hrs: clamp(Number(form.hrs) || 0, 0, 16), start: s, end: e }])
    setForm(null)
  }
  const deleteForm = () => { if (form && form.editing != null) { pushHist(); if (form.type === 'timeoff') setTimeoff((t) => t.filter((x) => x.id !== form.editing)); else setPlans((p) => p.filter((x) => x.id !== form.editing)) } setForm(null) }
  const delPlan = (id: string) => { pushHist(); setPlans((p) => p.filter((x) => x.id !== id)) }
  const delOff = (id: string) => { pushHist(); setTimeoff((t) => t.filter((x) => x.id !== id)) }

  const resync = async () => { setSyncing(true); try { await onResync() } finally { setSyncing(false) } }

  const syncedAgo = () => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(data.syncedAt).getTime()) / 60000))
    return mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`
  }

  const Toolbar = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0 16px', flexWrap: 'nowrap' }}>
      <div style={{ display: 'inline-flex', background: '#e3e5de', borderRadius: 9, padding: 3, flex: '0 0 auto' }}>{(['team', 'projects'] as const).map((v) => (<button key={v} onClick={() => setView(v)} style={pill(view, v)}>{v[0].toUpperCase() + v.slice(1)}</button>))}</div>
      {view === 'team' && <button onClick={() => { setPlanMode((p) => !p); setEditCap(false) }} style={{ flex: '0 0 auto', border: `1px solid ${planMode ? C.accent : C.line}`, cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 600, padding: '6px 13px', borderRadius: 8, background: planMode ? C.accent : '#fff', color: planMode ? '#fff' : C.ink2 }}>{planMode ? 'Done' : 'Plan ahead'}</button>}
      {planMode && <>
        <button onClick={undo} disabled={!past.length} title="Undo (⌘Z)" style={{ ...navBtn, flex: '0 0 auto', color: past.length ? C.ink2 : '#c2c4ba', fontSize: 14 }}>↩</button>
        <button onClick={redo} disabled={!future.length} title="Redo (⌘⇧Z)" style={{ ...navBtn, flex: '0 0 auto', color: future.length ? C.ink2 : '#c2c4ba', fontSize: 14 }}>↪</button>
      </>}
      {view === 'team' && !planMode && <button onClick={() => setEditCap((e) => !e)} style={{ flex: '0 0 auto', border: `1px solid ${editCap ? C.accent : C.line}`, cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 600, padding: '6px 13px', borderRadius: 8, background: editCap ? C.accent : '#fff', color: editCap ? '#fff' : C.ink2 }}>{editCap ? 'Done' : 'Edit capacity'}</button>}
      {editCap && edited && <button onClick={() => setCaps(Object.fromEntries(NAMES.map((n) => [n, DD[n].cap])))} style={{ flex: '0 0 auto', border: `1px solid ${C.line}`, cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 600, padding: '6px 10px', borderRadius: 8, background: '#fff', color: C.muted }}>Reset</button>}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, flex: '0 0 auto' }}>
        <div style={{ display: 'inline-flex', background: '#e3e5de', borderRadius: 8, padding: 2 }}>{[1, 2, 3, 4].map((n) => (<button key={n} onClick={() => setWeeksN(n)} style={{ ...pill(weeksN, n), padding: '5px 9px' }}>{n}w</button>))}</div>
        <button onClick={() => shift(-weeksN)} style={navBtn}><Chevron dir="left" /></button>
        <div style={{ minWidth: 118, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: C.ink }}>{dLabel(DAYS[0].key).replace(/^\w+, /, '')} – {dLabel(DAYS[NC - 1].key).replace(/^\w+, /, '')}</div>
        <button onClick={() => shift(weeksN)} style={navBtn}><Chevron dir="right" /></button>
        <button onClick={jumpToday} style={{ ...navBtn, width: 'auto', padding: '0 11px', fontSize: 11.5, fontWeight: 600, color: C.ink2 }}>Today</button>
      </div>
    </div>
  )

  const Header = () => (
    <div style={{ display: 'flex', borderBottom: `1px solid ${C.line}` }}>
      <div style={{ width: LEFT, flex: '0 0 auto', padding: '10px 14px', display: 'flex', alignItems: 'flex-end', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted }}>{view === 'team' ? 'Team' : 'Projects'}</div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex' }}>{WKS.map((wk, i) => (<div key={i} style={{ flex: 5, minWidth: 0, textAlign: 'center', padding: '7px 0 4px', borderLeft: i > 0 ? `1px solid ${C.gridWk}` : 'none', fontSize: 10.5, fontWeight: 700, color: C.ink }}>W{wk.ww} · {wk.label}</div>))}</div>
        <div style={{ display: 'flex', borderTop: `1px solid ${C.line2}` }}>{DAYS.map((d, i) => (<div key={i} style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '4px 0 6px', borderLeft: d.dow === 0 && i > 0 ? `1px solid ${C.gridWk}` : 'none', background: d.isToday ? 'rgba(143,145,127,.14)' : 'transparent' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: d.isToday ? C.accent : d.projected ? '#b5b8a9' : C.muted }}>{DOW[d.dow]}</div>
          <div style={{ fontSize: 9.5, color: d.isToday ? C.ink : C.muted, fontWeight: d.isToday ? 700 : 500 }}>{d.dayNum}</div>
        </div>))}</div>
      </div>
    </div>
  )

  const Bar = (it: any) => {
    const isOff = it.kind === 'off'
    const cl = isOff ? null : it.kind === 'plan' ? it.client : clientOf(it.label)
    const col = isOff ? C.off : clientColor(cl)
    const projected = it.kind === 'seg' && it.variant === 'projected'
    const draggable = it.kind === 'plan' || it.kind === 'off'
    const recurring = Boolean(it.recurring)
    const resizable = draggable && !recurring
    const left = `calc(${(it.s / NC) * 100}% + 2px)`, width = `calc(${((it.e - it.s + 1) / NC) * 100}% - 4px)`
    const top = PADV + it.lane * (BARH + GAP)
    const wide = it.e - it.s + 1 >= 2
    const label = isOff ? (wide ? (recurring ? 'Off ↻' : 'Time off') : 'Off') : `${cl}${wide ? ' · ' + +it.hrs.toFixed(1) + 'h' : ''}`
    const da = { 'data-kind': isOff ? 'off' : 'plan', 'data-id': it.id, 'data-start': it.start, 'data-end': it.end, ...(recurring ? { 'data-recurring': '1' } : {}) }
    return (
      <div key={it.kind + '-' + (it.id || it.label) + '-' + it.s} className={'rt-bar' + (draggable && planMode ? ' ed' : '')} title={isOff ? (recurring ? 'Recurring time off' : 'Time off') : `${cl} · ${+it.hrs.toFixed(2)}h/day`} style={{ position: 'absolute', left, width, top, height: BARH, display: 'flex', borderRadius: 4, overflow: 'hidden', pointerEvents: draggable ? 'auto' : 'none', background: projected ? col + '2E' : col, border: projected ? `1px dashed ${col}` : 'none', boxShadow: it.kind === 'plan' ? 'inset 0 0 0 1.5px rgba(255,255,255,.5), 0 1px 2px rgba(39,39,39,.18)' : projected ? 'none' : '0 1px 2px rgba(39,39,39,.13)' }}>
        {resizable && <div className="rt-grip" data-handle="L" {...da} style={{ width: planMode ? 10 : 6, flex: '0 0 auto', cursor: planMode ? 'ew-resize' : 'default', background: planMode ? 'rgba(255,255,255,.32)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{planMode && <span data-handle="L" {...da} style={{ width: 3, height: 11, borderLeft: '1.5px solid rgba(255,255,255,.9)', borderRight: '1.5px solid rgba(255,255,255,.9)' }} />}</div>}
        <div {...(draggable ? { 'data-handle': 'M', ...da } : {})} title={draggable && planMode ? (recurring ? 'Click to edit the recurring rule' : 'Click to edit · drag to move') : undefined} style={{ flex: 1, minWidth: 0, cursor: draggable && planMode ? (recurring ? 'pointer' : 'grab') : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, color: projected ? col : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', padding: '0 3px' }}>{label}</div>
        {resizable && <div className="rt-grip" data-handle="R" {...da} style={{ width: planMode ? 10 : 6, flex: '0 0 auto', cursor: planMode ? 'ew-resize' : 'default', background: planMode ? 'rgba(255,255,255,.32)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{planMode && <span data-handle="R" {...da} style={{ width: 3, height: 11, borderLeft: '1.5px solid rgba(255,255,255,.9)', borderRight: '1.5px solid rgba(255,255,255,.9)' }} />}</div>}
      </div>
    )
  }

  const isRecruiter = (name: string) => /recruit/i.test(DD[name].role || '')
  const teamSections = [
    { title: 'Recruiters', names: NAMES.filter(isRecruiter) },
    { title: 'Everyone else', names: NAMES.filter((n) => !isRecruiter(n)) },
  ].filter((s) => s.names.length)

  const renderTeamRow = (name: string) => {
    const cap = caps[name] ?? DD[name].cap
    const changed = cap !== DD[name].cap
    const util = winUtil(name)
    const uc = util == null ? C.muted : util > 105 ? C.neg : util >= 85 ? C.pos : C.ink
    const cds = DAYS.map((day) => getCell(name, day))
    const labelSet = new Set<string>()
    cds.forEach((cd) => { if (cd && cd.p) Object.keys(cd.p).forEach((l) => { if (!l.endsWith('· planned')) labelSet.add(l) }) })
    const items: any[] = []
    labelSet.forEach((label) => { const wv = cds.map((cd) => (cd && cd.p && cd.p[label] > 0 ? { h: cd.p[label], variant: cd.variant } : null)); mergeSegs(wv).forEach((sg) => items.push({ ...sg, kind: 'seg', label })) })
    plans.filter((p) => p.name === name).forEach((p) => { const ii = DAYS.map((w, i) => i).filter((i) => DAYS[i].key >= p.start && DAYS[i].key <= p.end); if (ii.length) items.push({ s: ii[0], e: ii[ii.length - 1], kind: 'plan', id: p.id, client: p.client, hrs: p.hrs, start: p.start, end: p.end }) })
    timeoff.filter((o) => o.name === name).forEach((o) => {
      const ii = DAYS.map((w, i) => i).filter((i) => offMatches(o, DAYS[i]))
      if (!ii.length) return
      if (o.weekdays?.length) {
        // recurring: consecutive matching columns merge into per-week segments
        const runs: [number, number][] = []
        ii.forEach((i) => { const last = runs[runs.length - 1]; if (last && i === last[1] + 1) last[1] = i; else runs.push([i, i]) })
        runs.forEach(([s, e]) => items.push({ s, e, kind: 'off', id: o.id, start: o.start, end: o.end, recurring: true }))
      } else {
        items.push({ s: ii[0], e: ii[ii.length - 1], kind: 'off', id: o.id, start: o.start, end: o.end })
      }
    })
    const nLanes = packLanes(items)
    const rowH = Math.max(44, PADV * 2 + nLanes * BARH + (nLanes - 1) * GAP)
    const selHere = drag && drag.mode === 'create' && drag.name === name ? { a: Math.min(drag.aIdx!, drag.bIdx!), b: Math.max(drag.aIdx!, drag.bIdx!) } : null
    return (
      <div key={name} className="rt-row" style={{ display: 'flex', borderBottom: `1px solid ${C.line2}` }}>
        <div style={{ width: LEFT, flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px' }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', flex: '0 0 auto', background: C.accent + '26', color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.muted, marginTop: 1 }}>{DD[name].role || 'Team'} ·
              {editCap ? (<><input type="number" value={cap} min={0} max={80} onChange={(e) => setCap(name, e.target.value)} style={{ width: 40, fontFamily: SANS, fontSize: 11, fontWeight: 700, color: C.ink, textAlign: 'right', border: `1px solid ${changed ? C.accent : C.line}`, borderRadius: 5, padding: '2px 4px' }} /><span>h/wk</span></>) : (<span style={{ color: changed ? C.accent : C.muted, fontWeight: changed ? 700 : 400 }}>{cap}h/wk{changed ? ' ✎' : ''}</span>)}
            </span>
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: uc }}>{util == null ? '—' : util + '%'}</span>
        </div>
        <div onMouseDown={(e) => beginDrag(e, name)} style={{ position: 'relative', flex: 1, minWidth: 0, height: rowH, backgroundImage: gridBg(NC), cursor: planMode ? 'crosshair' : 'default', userSelect: 'none' }}>
          {todayIdx >= 0 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${todayIdx}*100%/${NC})`, width: `calc(100%/${NC})`, background: 'rgba(143,145,127,.12)', pointerEvents: 'none' }} />}
          {selHere && <div style={{ position: 'absolute', top: 4, bottom: 4, left: `${(selHere.a / NC) * 100}%`, width: `${((selHere.b - selHere.a + 1) / NC) * 100}%`, background: 'rgba(143,145,127,.22)', border: `1.5px dashed ${C.accent}`, borderRadius: 4, pointerEvents: 'none' }} />}
          {items.map(Bar)}
        </div>
      </div>
    )
  }

  const agg: Record<string, Record<string, { h: number; variant: string }>> = {}
  NAMES.forEach((name) => DAYS.forEach((day) => { const cd = getCell(name, day); if (!cd || cd.off || !cd.p) return; for (const [l, h] of Object.entries(cd.p)) { if (h <= 0) continue; agg[l] = agg[l] || {}; const e = agg[l][day.key] || { h: 0, variant: cd.variant }; e.h += h; if (cd.variant !== 'actual') e.variant = cd.variant; agg[l][day.key] = e } }))
  const projLabels = Object.keys(agg).sort((a, b) => { const s = (o: Record<string, { h: number }>) => Object.values(o).reduce((x, e) => x + e.h, 0); return s(agg[b]) - s(agg[a]) })

  const selS: React.CSSProperties = { fontFamily: SANS, fontSize: 12.5, padding: '7px 9px', borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff', color: C.ink, width: '100%' }
  // selects hide the browser chevron and draw one inset 12px from the right edge
  const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%234b4d44' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`
  const ddS: React.CSSProperties = { ...selS, appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', backgroundImage: chevron, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 34 }
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, display: 'block', marginBottom: 5 }

  return (
    <div className="rt" style={{ minHeight: '100%', fontFamily: SANS, color: C.ink2 }}>
      <style>{`
        .rt button { transition: box-shadow .13s ease, filter .13s ease, background .13s ease, border-color .13s ease; }
        .rt button:hover:not(:disabled) { filter: brightness(.975); }
        .rt button:active:not(:disabled) { transform: translateY(.5px); }
        .rt select, .rt input { transition: border-color .13s ease, box-shadow .13s ease; }
        .rt select:focus, .rt input:focus { outline: none; border-color: ${C.accent}; box-shadow: 0 0 0 3px rgba(143,145,127,.18); }
        .rt-row { transition: background .1s ease; }
        .rt-row:hover { background: #fafbf7; }
        .rt-bar { transition: box-shadow .15s ease, filter .15s ease, transform .1s ease; }
        .rt-bar.ed { cursor: pointer; }
        .rt-bar.ed:hover { filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 4px 11px rgba(39,39,39,.24) !important; z-index: 6; }
        .rt-grip { opacity: 0; transition: opacity .13s ease; }
        .rt-bar.ed:hover .rt-grip { opacity: 1; }
        .rt-backdrop { animation: rtbd .15s ease both; }
        .rt-modal { animation: rtpop .2s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes rtbd { from { opacity: 0 } to { opacity: 1 } }
        @keyframes rtpop { from { opacity: 0; transform: translateY(9px) scale(.985) } to { opacity: 1; transform: none } }
      `}</style>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 26px 70px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ margin: '0 0 3px', fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', color: C.ink }}>Resourcing</h1>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: saveState === 'error' ? C.neg : C.muted, fontWeight: 600 }}>
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Save failed — retrying on next change' : ''}
          </span>
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>Daily Mon–Fri schedule · Harvest actuals through {dLabel(LAST_ACTUAL)} · <span style={{ fontStyle: 'italic' }}>dashed = projected · ringed = planned · dark = time off</span></span>
          <span style={{ color: C.line }}>|</span>
          <span>Synced {syncedAgo()}</span>
          <button onClick={resync} disabled={syncing} style={{ border: `1px solid ${C.line}`, cursor: 'pointer', fontFamily: SANS, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 7, background: '#fff', color: C.ink2 }}>{syncing ? 'Syncing…' : 'Sync now'}</button>
        </div>
        <Toolbar />
        {planMode && <div style={{ margin: '-6px 0 14px', fontSize: 12, color: C.accent, fontWeight: 600 }}>Planning on — drag across days to book · drag a bar’s grips to resize, middle to move · click a bar to edit/delete · ⌘Z to undo.</div>}
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(39,39,39,.04)' }}>
          <Header />
          {view === 'team' && teamSections.map((sec) => (
            <React.Fragment key={sec.title}>
              <div style={{ padding: '9px 14px 7px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: C.muted, background: '#f3f4ee', borderBottom: `1px solid ${C.line2}` }}>
                {sec.title} <span style={{ fontWeight: 500 }}>· {sec.names.length}</span>
              </div>
              {sec.names.map(renderTeamRow)}
            </React.Fragment>
          ))}
          {view === 'projects' && projLabels.map((label, pi) => {
            const cl = clientOf(label)
            const col = clientColor(cl)
            const kind = label.split(' · ')[1] || ''
            const wv = DAYS.map((day) => { const e = agg[label][day.key]; return e && e.h > 0 ? { h: e.h, variant: e.variant } : null })
            const segs = mergeSegs(wv).map((sg) => ({ ...sg, kind: 'seg', label }))
            const burned = BURNED[label]
            const budget = budgets[label]
            const start = PSTART[label]
            const ongoing = kind === 'delivery'
            const plannedH = plans.filter((p) => p.client === cl).reduce((s, p) => s + (Number(p.hrs) || 0) * bizDays(p.start, p.end), 0)
            const proj = (burned || 0) + plannedH
            let status: string | null = null, sc = C.pos
            if (budget) { const pct = burned / budget, ppct = proj / budget; if (burned > budget) { status = 'Over budget'; sc = C.neg } else if (ppct >= 1) { status = 'Will exceed'; sc = C.neg } else if (pct >= 0.8 || ppct >= 0.9) { status = 'At risk'; sc = C.gold } else { status = 'On track'; sc = C.pos } }
            const pctW = budget ? Math.min(burned / budget, 1) * 100 : 0
            const planW = budget ? Math.min(Math.max(proj - burned, 0) / budget, Math.max(1 - burned / budget, 0)) * 100 : 0
            const rowH = 62
            return (
              <div key={pi} className="rt-row" style={{ display: 'flex', minHeight: rowH, borderBottom: `1px solid ${C.line2}` }}>
                <div style={{ width: LEFT, flex: '0 0 auto', padding: '7px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: col, flex: '0 0 auto' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{cl}</span>
                    {status && <span style={{ marginLeft: 'auto', flex: '0 0 auto', fontSize: 9.5, fontWeight: 700, color: sc, background: sc + '1E', padding: '2px 7px', borderRadius: 999, letterSpacing: '.02em' }}>{status}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingLeft: 17 }}>
                    {kind} · {start ? `${dLabel(start).replace(/^\w+, /, '')} → ${ongoing ? 'ongoing' : 'now'}` : '—'}
                  </div>
                  <div style={{ paddingLeft: 17, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {budget ? (
                      <>
                        <div style={{ flex: 1, minWidth: 0, height: 6, borderRadius: 4, background: C.line2, position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pctW}%`, background: sc, borderRadius: 4 }} />
                          {planW > 0 && <div style={{ position: 'absolute', left: `${pctW}%`, top: 0, bottom: 0, width: `${planW}%`, background: sc, opacity: 0.35 }} />}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.ink2, whiteSpace: 'nowrap' }}>{Math.round(burned || 0)}/</span>
                        <input type="number" value={budget} min={0} onChange={(e) => setBudget(label, e.target.value)} title="Budget (hours) — editable target, not in Harvest" style={{ width: 44, fontFamily: SANS, fontSize: 10, fontWeight: 700, color: C.ink, textAlign: 'right', border: `1px solid ${C.line}`, borderRadius: 4, padding: '1px 3px' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.muted }}>h</span>
                      </>
                    ) : ongoing ? (
                      <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>Ongoing · {Math.round(burned || 0)}h logged{plannedH > 0 ? ` · +${Math.round(plannedH)}h planned` : ''}</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 10, color: C.muted, fontWeight: 600, whiteSpace: 'nowrap' }}>{Math.round(burned || 0)}h logged · budget</span>
                        <input type="number" placeholder="set" min={0} onChange={(e) => setBudget(label, e.target.value)} title="Set an hours budget for this search" style={{ width: 44, fontFamily: SANS, fontSize: 10, fontWeight: 700, color: C.ink, textAlign: 'right', border: `1px solid ${C.line}`, borderRadius: 4, padding: '1px 3px' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.muted }}>h</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: rowH, backgroundImage: gridBg(NC) }}>
                  {todayIdx >= 0 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${todayIdx}*100%/${NC})`, width: `calc(100%/${NC})`, background: 'rgba(143,145,127,.12)' }} />}
                  {segs.map((sg: any) => { sg.lane = 0; return Bar(sg) })}
                </div>
              </div>
            )
          })}
        </div>

        {(plans.length > 0 || timeoff.length > 0) && (
          <div style={{ marginTop: 18, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: C.muted, marginBottom: 10 }}>Planned changes</div>
            {plans.map((b) => (<div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 12.5, color: C.ink2, borderBottom: `1px solid ${C.line2}` }}><span style={{ width: 9, height: 9, borderRadius: 2, background: clientColor(b.client) }} /><b style={{ color: C.ink }}>{b.name}</b> → {b.client}<span style={{ color: C.muted }}>{b.hrs}h/day · {dLabel(b.start)}–{dLabel(b.end)}</span><button onClick={() => delPlan(b.id)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: C.muted, fontSize: 15 }}>×</button></div>))}
            {timeoff.map((o) => (<div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 12.5, color: C.ink2, borderBottom: `1px solid ${C.line2}` }}><span style={{ width: 9, height: 9, borderRadius: 2, background: C.off }} /><b style={{ color: C.ink }}>{o.name}</b> — Time off<span style={{ color: C.muted }}>{o.weekdays?.length ? `every ${o.weekdays.map((d) => WD_NAMES[d]).join(', ')} from ${dLabel(o.start)}${o.end ? ` until ${dLabel(o.end)}` : ''}` : `${dLabel(o.start)}–${dLabel(o.end || o.start)}`}</span><button onClick={() => delOff(o.id)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: C.muted, fontSize: 15 }}>×</button></div>))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16, fontSize: 11.5, color: C.muted, fontWeight: 600 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 10, borderRadius: 3, background: CLR.Superhuman }} />Actual (Harvest)</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 10, borderRadius: 3, background: CLR.Superhuman + '2E', border: `1px dashed ${CLR.Superhuman}` }} />Projected</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 10, borderRadius: 3, background: C.accent, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.65)' }} />Planned</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 10, borderRadius: 3, background: C.off }} />Time off</span>
        </div>
        <div style={{ color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 22, fontWeight: 500 }}>Per-day hours from Harvest. Contiguous days on a project merge into one bar. Utilization = day hours ÷ (weekly cap ÷ 5). Bookings, time off, budgets and capacity edits are saved for the whole team.</div>
      </div>

      {form && (
        <div className="rt-backdrop" onMouseDown={() => setForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(39,39,39,.32)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="rt-modal" onMouseDown={(e) => e.stopPropagation()} style={{ width: 360, background: '#fff', borderRadius: 14, padding: '22px 22px 20px', boxShadow: '0 20px 50px rgba(39,39,39,.28)', fontFamily: SANS }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.02em', color: C.ink, marginBottom: 16 }}>{form.editing != null ? 'Edit ' : 'Add '}{form.type === 'timeoff' ? 'time off' : 'booking'}</div>
            {form.editing == null && <div style={{ display: 'inline-flex', background: '#e3e5de', borderRadius: 8, padding: 3, marginBottom: 16 }}>{([['booking', 'Booking'], ['timeoff', 'Time off']] as const).map(([v, t]) => (<button key={v} onClick={() => setForm((f) => (f ? { ...f, type: v } : f))} style={pill(form.type, v)}>{t}</button>))}</div>}
            <div style={{ marginBottom: 12 }}><label style={lbl}>Person</label><select value={form.name} disabled={form.type === 'timeoff' && form.all} onChange={(e) => setForm((f) => (f ? { ...f, name: e.target.value } : f))} style={{ ...ddS, opacity: form.type === 'timeoff' && form.all ? 0.5 : 1 }}>{NAMES.map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
            {form.type === 'timeoff' && <>
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div>
                  <label style={lbl}>Repeats</label>
                  <div style={{ display: 'inline-flex', background: '#e3e5de', borderRadius: 8, padding: 3 }}>{([['once', 'Once'], ['weekly', 'Weekly']] as const).map(([v, t]) => (<button key={v} onClick={() => setForm((f) => (f ? { ...f, repeat: v } : f))} style={pill(form.repeat || 'once', v)}>{t}</button>))}</div>
                </div>
                {form.repeat === 'weekly' && <div>
                  <label style={lbl}>On days</label>
                  <div style={{ display: 'inline-flex', gap: 4 }}>{WD_NAMES.map((wd, i) => { const on = form.weekdays?.includes(i); return (
                    <button key={wd} onClick={() => setForm((f) => (f ? { ...f, weekdays: on ? (f.weekdays || []).filter((x) => x !== i) : [...(f.weekdays || []), i].sort() } : f))} style={{ width: 34, height: 28, borderRadius: 7, border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accent : '#fff', color: on ? '#fff' : C.ink2, fontFamily: SANS, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{wd[0] + (wd === 'Thu' ? 'h' : wd === 'Tue' ? 'u' : '')}</button>
                  ) })}</div>
                </div>}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.ink2, marginBottom: 12, cursor: 'pointer' }}><input type="checkbox" checked={form.all} onChange={(e) => setForm((f) => (f ? { ...f, all: e.target.checked } : f))} />Apply to the whole team</label>
            </>}
            {form.type === 'booking' && <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 2 }}><label style={lbl}>Client / project</label><select value={form.client} onChange={(e) => setForm((f) => (f ? { ...f, client: e.target.value } : f))} style={ddS}>{CLIENTS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              <div style={{ flex: 1 }}><label style={lbl}>Hrs/day</label><input type="number" min={0} max={16} value={form.hrs} onChange={(e) => setForm((f) => (f ? { ...f, hrs: e.target.value } : f))} style={selS} /></div>
            </div>}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1 }}><label style={lbl}>From day</label><select value={form.start} onChange={(e) => setForm((f) => (f ? { ...f, start: e.target.value } : f))} style={ddS}>{horizon.map((k) => <option key={k} value={k}>{dLabel(k)}</option>)}</select></div>
              <div style={{ flex: 1 }}><label style={lbl}>{weekly ? 'Until (optional)' : 'To day'}</label><select value={form.end} onChange={(e) => setForm((f) => (f ? { ...f, end: e.target.value } : f))} style={ddS}>{weekly && <option value="">No end date</option>}{horizon.map((k) => <option key={k} value={k}>{dLabel(k)}</option>)}</select></div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {form.editing != null && <button onClick={deleteForm} style={{ border: `1px solid ${C.neg}44`, background: '#fff', cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.neg, padding: '9px 14px', borderRadius: 9 }}>Delete</button>}
              <button onClick={() => setForm(null)} style={{ marginLeft: 'auto', border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.ink2, padding: '9px 16px', borderRadius: 9 }}>Cancel</button>
              <button onClick={submitForm} disabled={!canSubmit} title={canSubmit ? undefined : 'Pick at least one weekday'} style={{ border: 'none', background: C.accent, cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.5, fontFamily: SANS, fontSize: 13, fontWeight: 700, color: '#fff', padding: '9px 18px', borderRadius: 9 }}>{form.editing != null ? 'Save' : form.type === 'timeoff' ? 'Mark off' : 'Add booking'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
