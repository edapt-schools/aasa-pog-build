import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Mic,
  MicOff,
  Paperclip,
  ArrowUp,
  ExternalLink,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Check,
  Plus,
  Minus,
  Download,
  Loader2,
  X,
  FileText,
  Zap,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type {
  CommandDistrictResult,
  CommandRequest,
  EngagementEvent,
  GrantCriteria,
} from '@aasa-platform/shared'
import { Button } from '../components/ui/button'
import { useCommandSearch } from '../hooks/useCommandSearch'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../lib/api-client'

// ── Storage helpers (unchanged wiring) ────────────────────────

const CONTACT_HISTORY_STORAGE_KEY = 'aasa_contact_events_v1'
const COHORT_STORAGE_KEY = 'aasa_grant_cohort_v1'

function getStoredEvents(): EngagementEvent[] {
  try {
    const raw = localStorage.getItem(CONTACT_HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function storeEvent(event: EngagementEvent) {
  const events = getStoredEvents()
  events.push(event)
  localStorage.setItem(CONTACT_HISTORY_STORAGE_KEY, JSON.stringify(events.slice(-500)))
}

function getStoredCohort(): CommandDistrictResult[] {
  try {
    const raw = localStorage.getItem(COHORT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function storeCohort(rows: CommandDistrictResult[]) {
  localStorage.setItem(COHORT_STORAGE_KEY, JSON.stringify(rows))
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number | null | undefined>>) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          const str = value === null || value === undefined ? '' : String(value)
          return `"${str.replace(/"/g, '""')}"`
        })
        .join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// ── Sub-components ─────────────────────────────────────────

/** Prompt Input Bar — ChatGPT-style with file & mic */
function PromptInput({
  prompt,
  setPrompt,
  onSubmit,
  loading,
  attachment,
  onAttach,
  onClearAttachment,
}: {
  prompt: string
  setPrompt: (v: string) => void
  onSubmit: () => void
  loading: boolean
  attachment?: { filename: string } | undefined
  onAttach: (file: File) => void
  onClearAttachment: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isListening, setIsListening] = useState(false)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [prompt])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  const handleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not available in this browser.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    setIsListening(true)
    recognition.onresult = (event: any) => {
      const transcript = event?.results?.[0]?.[0]?.transcript || ''
      setPrompt(prompt ? `${prompt} ${transcript}`.trim() : transcript)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognition.start()
  }

  return (
    <div className="w-full">
      {/* Attachment indicator */}
      {attachment && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="flex items-center gap-2 rounded-lg bg-accent/10 text-accent px-3 py-1.5 text-xs font-medium">
            <FileText className="w-3.5 h-3.5" />
            {attachment.filename}
            <button type="button" onClick={onClearAttachment} className="hover:text-foreground ml-1">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <div className="relative rounded-2xl border border-border bg-card shadow-sm focus-within:ring-2 focus-within:ring-accent/30 focus-within:border-accent/50 transition-all duration-[var(--motion-fast)]">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for leads, upload a grant RFP, or speak..."
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none min-h-[52px] max-h-[200px]"
        />

        {/* Bottom toolbar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-0.5">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".txt,.md,.csv,.json,.pdf"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onAttach(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleMic}
              className={`p-2.5 rounded-lg transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center ${
                isListening
                  ? 'text-accent bg-accent/10 animate-pulse'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
              title={isListening ? 'Listening...' : 'Voice input'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || !prompt.trim()}
            className="p-2.5 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
            title="Send"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/** AI Summary Card */
function AISummary({
  text,
  grantCriteria,
  reasoning,
}: {
  text: string
  grantCriteria?: GrantCriteria
  reasoning?: { summary: string; steps: string[] }
}) {
  const [showThinking, setShowThinking] = useState(false)

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
          <Zap className="w-3.5 h-3.5 text-accent" />
        </div>
        <div className="space-y-2 min-w-0 w-full">
          <p className="text-sm text-foreground leading-relaxed">{text}</p>
          {grantCriteria && (grantCriteria.frplMin || grantCriteria.minorityMin) && (
            <div className="flex flex-wrap gap-2">
              {grantCriteria.frplMin && (
                <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  FRPL &ge; {grantCriteria.frplMin}%
                </span>
              )}
              {grantCriteria.minorityMin && (
                <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  Minority &ge; {grantCriteria.minorityMin}%
                </span>
              )}
            </div>
          )}
          {reasoning && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowThinking((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-medium"
              >
                {showThinking ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showThinking ? 'Hide ranking logic' : 'Show ranking logic'}
              </button>
              {showThinking && (
                <div className="mt-2 rounded-lg border border-accent/20 bg-background/70 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">{reasoning.summary}</p>
                  <ul className="space-y-1">
                    {reasoning.steps.map((step, idx) => (
                      <li key={`${step}-${idx}`} className="text-xs text-foreground leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Confidence-based tier badge derived from composite score */
function ScoreBadge({ composite }: { composite: number }) {
  let label: string
  let color: string
  if (composite >= 7) {
    label = 'High'
    color = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
  } else if (composite >= 4) {
    label = 'Medium'
    color = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
  } else {
    label = 'Low'
    color = 'bg-muted text-muted-foreground'
  }
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${color}`}>
      {label}
    </span>
  )
}

/** Confidence indicator */
function ConfidenceDot({ band }: { band: string }) {
  const color =
    band === 'high'
      ? 'bg-emerald-500'
      : band === 'medium'
        ? 'bg-amber-500'
        : 'bg-red-400'
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground capitalize">{band}</span>
    </span>
  )
}

/** Single result row with expandable "Why" panel */
function ResultRow({
  result,
  rank,
  isExpanded,
  onToggle,
  whyOverride,
  onLoadWhy,
  onMarkContacted,
  onAddToCohort,
  onRemoveFromCohort,
  inCohort,
}: {
  result: CommandDistrictResult
  rank: number
  isExpanded: boolean
  onToggle: () => void
  whyOverride?: { summary: string; excerpts: Array<{ keyword: string; excerpt: string; documentUrl?: string | null }> }
  onLoadWhy: () => void
  onMarkContacted: () => void
  onAddToCohort: () => void
  onRemoveFromCohort: () => void
  inCohort: boolean
}) {
  const d = result.district
  const why = whyOverride || result.why

  return (
    <div className="border border-border rounded-lg bg-card hover:border-accent/30 transition-colors duration-[var(--motion-fast)]">
      {/* Main row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-xs text-muted-foreground font-mono w-5 text-right shrink-0">{rank}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{d.name}</span>
            <ScoreBadge composite={result.score.composite} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {d.city && `${d.city}, `}{d.state}
            {d.enrollment ? ` · ${d.enrollment.toLocaleString()} students` : ''}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-sm font-semibold text-foreground tabular-nums">
              {result.score.composite.toFixed(1)}
            </div>
            <div className="text-[11px] text-muted-foreground">score</div>
          </div>
          <ConfidenceDot band={result.why.confidenceBand} />
        </div>

        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded "Why this district" panel */}
      {isExpanded && (
        <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/20">
          {/* Why summary */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Why this district
            </h4>
            <p className="text-sm text-foreground leading-relaxed">
              {why.summary}
            </p>
          </div>

          {/* Signal tags */}
          {result.why.topSignals.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.why.topSignals.map((signal) => (
                <span
                  key={`${signal.category}-${signal.signal}`}
                  className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
                >
                  {signal.signal}
                  <span className="opacity-60">{signal.weight.toFixed(1)}</span>
                </span>
              ))}
            </div>
          )}

          {/* Evidence excerpts */}
          {((why as any).sourceExcerpts?.length > 0 || (whyOverride?.excerpts?.length ?? 0) > 0) && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Evidence
              </h4>
              <div className="space-y-2">
                {(whyOverride?.excerpts || (why as any).sourceExcerpts || []).slice(0, 3).map((ex: any, i: number) => (
                  <div key={`${d.ncesId}-ex-${i}`} className="rounded-lg bg-background border border-border p-3">
                    <span className="text-xs font-medium text-accent">{ex.keyword}</span>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">{ex.excerpt}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Load full rationale link */}
          {!whyOverride && (
            <button
              type="button"
              className="text-xs text-accent hover:underline font-medium"
              onClick={(e) => { e.stopPropagation(); onLoadWhy() }}
            >
              Load full rationale &rarr;
            </button>
          )}

          {/* Score breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Readiness', value: result.score.readiness },
              { label: 'Alignment', value: result.score.alignment },
              { label: 'Activation', value: result.score.activation },
              { label: 'Branding', value: result.score.branding },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-lg font-semibold text-foreground tabular-nums">{s.value?.toFixed(1) ?? '—'}</div>
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2 pt-3">
            {result.actions.openDistrictSite && (
              <a
                href={result.actions.openDistrictSite}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors min-h-[36px]"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Website
              </a>
            )}
            {result.actions.email && (
              <a
                href={`mailto:${result.actions.email}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors min-h-[36px]"
                onClick={(e) => { e.stopPropagation(); onMarkContacted() }}
              >
                <Mail className="w-3.5 h-3.5" /> {result.actions.email}
              </a>
            )}
            {d.phone && (
              <a
                href={`tel:${d.phone}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors min-h-[36px]"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="w-3.5 h-3.5" /> {d.phone}
              </a>
            )}

            <div className="flex-1" />

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMarkContacted() }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors min-h-[36px]"
            >
              <Check className="w-3.5 h-3.5" /> Mark contacted
            </button>
            {inCohort ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemoveFromCohort() }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 text-accent px-3 py-2 text-xs font-medium hover:bg-accent/20 transition-colors min-h-[36px]"
              >
                <Minus className="w-3.5 h-3.5" /> In cohort
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAddToCohort() }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent/10 hover:text-accent hover:border-accent/30 transition-colors min-h-[36px]"
              >
                <Plus className="w-3.5 h-3.5" /> Add to cohort
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Cohort tray at bottom */
function CohortTray({
  cohort,
  onExport,
  onClear,
}: {
  cohort: CommandDistrictResult[]
  onExport: () => void
  onClear: () => void
}) {
  if (cohort.length === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">
              {cohort.length}
            </div>
            <span className="text-sm font-medium text-foreground">in cohort</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 overflow-hidden">
            {cohort.slice(0, 3).map((item) => (
              <span
                key={item.district.ncesId}
                className="text-xs bg-muted rounded-md px-2 py-0.5 truncate max-w-[120px]"
              >
                {item.district.name}
              </span>
            ))}
            {cohort.length > 3 && (
              <span className="text-xs text-muted-foreground">+{cohort.length - 3} more</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}


/** Floating lava-lamp orbs — AASA brand: dark blue #173054 + gold #fcd50e
 *  Orbs take turns — when blue is visible, gold fades out, and vice versa.
 *  They roam across the full screen so neither color is pinned to a corner. */
function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden="true">
      <div className="absolute rounded-full orb-blue-1" />
      <div className="absolute rounded-full orb-blue-2" />
      <div className="absolute rounded-full orb-gold-1" />
      <div className="absolute rounded-full orb-gold-2" />

      <style>{`
        /* ── Blue orbs ─────────────────────────── */
        .orb-blue-1 {
          width: 450px; height: 450px;
          background: #173054;
          filter: blur(80px);
          top: 20%; left: 30%;
          animation: roam-b1 30s ease-in-out infinite, phase-blue 16s ease-in-out infinite;
        }
        .orb-blue-2 {
          width: 350px; height: 350px;
          background: #173054;
          filter: blur(65px);
          top: 45%; left: 55%;
          animation: roam-b2 26s ease-in-out infinite, phase-blue 16s ease-in-out infinite;
          animation-delay: 2s, 2s;
        }

        /* ── Gold orbs ─────────────────────────── */
        .orb-gold-1 {
          width: 420px; height: 420px;
          background: #fcd50e;
          filter: blur(75px);
          top: 35%; left: 20%;
          animation: roam-g1 28s ease-in-out infinite, phase-gold 16s ease-in-out infinite;
        }
        .orb-gold-2 {
          width: 330px; height: 330px;
          background: #fcd50e;
          filter: blur(60px);
          top: 15%; left: 50%;
          animation: roam-g2 24s ease-in-out infinite, phase-gold 16s ease-in-out infinite;
          animation-delay: 2s, 2s;
        }

        /* ── Alternating fade: blue and gold take turns ── */
        /* Blue fades in while gold fades out, then swap */
        @keyframes phase-blue {
          0%   { opacity: 0; }
          10%  { opacity: 0.16; }
          40%  { opacity: 0.14; }
          50%  { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes phase-gold {
          0%   { opacity: 0; }
          50%  { opacity: 0; }
          60%  { opacity: 0.14; }
          90%  { opacity: 0.12; }
          100% { opacity: 0; }
        }

        /* ── Roaming paths (viewport-relative, full screen) ── */
        @keyframes roam-b1 {
          0%   { transform: translate(0, 0) scale(1); }
          20%  { transform: translate(25vw, 15vh) scale(1.08); }
          40%  { transform: translate(-10vw, 30vh) scale(0.94); }
          60%  { transform: translate(15vw, -10vh) scale(1.04); }
          80%  { transform: translate(-20vw, 10vh) scale(0.96); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes roam-b2 {
          0%   { transform: translate(0, 0) scale(1); }
          25%  { transform: translate(-25vw, -15vh) scale(1.06); }
          50%  { transform: translate(-15vw, 20vh) scale(0.92); }
          75%  { transform: translate(20vw, 5vh) scale(1.08); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes roam-g1 {
          0%   { transform: translate(0, 0) scale(1); }
          20%  { transform: translate(30vw, -20vh) scale(0.92); }
          45%  { transform: translate(20vw, 15vh) scale(1.1); }
          70%  { transform: translate(-15vw, -5vh) scale(0.95); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes roam-g2 {
          0%   { transform: translate(0, 0) scale(1); }
          30%  { transform: translate(-20vw, 25vh) scale(1.08); }
          60%  { transform: translate(10vw, 10vh) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }
      `}</style>
    </div>
  )
}


// ── Main Component ─────────────────────────────────────────

const WELCOME_BACK_KEY = 'aasa_last_visit_ts'
const WELCOME_BACK_COOLDOWN_MS = 60 * 60 * 1000 // 1 hour

/**
 * Read-only check: should we show the welcome-back greeting?
 * The timestamp is written separately in a useEffect to avoid
 * Strict Mode double-render side-effect issues.
 */
function shouldShowWelcome(): boolean {
  const lastVisit = localStorage.getItem(WELCOME_BACK_KEY)
  const lastTs = lastVisit ? parseInt(lastVisit, 10) : 0
  if (!lastTs) return true // First ever visit
  return (Date.now() - lastTs) > WELCOME_BACK_COOLDOWN_MS
}

function extractFirstName(email?: string | null): string | null {
  if (!email) return null
  const local = email.split('@')[0] ?? ''
  const raw = local.split(/[._\-+]/)[0] ?? ''
  if (raw.length >= 2) {
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
  }
  return null
}

export default function CommandCenter() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [attachment, setAttachment] = useState<{ filename: string; mimeType: string; textContent: string } | undefined>()
  const [whyOverrides, setWhyOverrides] = useState<Record<string, { summary: string; excerpts: Array<{ keyword: string; excerpt: string; documentUrl?: string | null }> }>>({})
  const [criteriaOverrides, setCriteriaOverrides] = useState<GrantCriteria>({})
  const [cohort, setCohort] = useState<CommandDistrictResult[]>(() => getStoredCohort())
  const [engagementEvents, setEngagementEvents] = useState<EngagementEvent[]>(() => getStoredEvents())
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [latestExplanation, setLatestExplanation] = useState('')
  const [latestReasoning, setLatestReasoning] = useState<{ summary: string; steps: string[] } | undefined>()
  const [latestResults, setLatestResults] = useState<CommandDistrictResult[]>([])
  const [latestGrantCriteria, setLatestGrantCriteria] = useState<GrantCriteria | undefined>()
  const { data, loading, error, run } = useCommandSearch()
  const [lastResponseAt, setLastResponseAt] = useState<string | null>(null)

  // Welcome-back state: read once (pure), write timestamp in effect
  const [showWelcome] = useState(() => shouldShowWelcome())
  const firstName = useMemo(() => extractFirstName(user?.email), [user?.email])

  useEffect(() => {
    // Stamp the visit timestamp (side-effect, safe from Strict Mode double-render)
    localStorage.setItem(WELCOME_BACK_KEY, String(Date.now()))
  }, [])

  const starterPrompts = useMemo(
    () => [
      { text: 'Next hottest uncontacted leads in TX', icon: '🔥' },
      { text: 'Find grants-ready districts with FRPL > 70% and minority > 60%', icon: '🎯' },
      { text: 'Districts with strong strategic plan evidence', icon: '📋' },
      { text: 'Build a hit list of top 20 tier 1 districts', icon: '⚡' },
      { text: 'Weekly strategic briefing', icon: '📊' },
      { text: 'Show districts with Measure What Matters evidence', icon: '🔍' },
    ],
    []
  )

  const handleAttachFile = async (file: File) => {
    const textContent = await file.text()
    setAttachment({
      filename: file.name,
      mimeType: file.type || 'text/plain',
      textContent: textContent.slice(0, 120_000),
    })
  }

  const runPrompt = async (value?: string) => {
    const text = (value || prompt).trim()
    if (!text) return
    setHasSearched(true)
    setExpandedRow(null)

    const request: CommandRequest = {
      prompt: text,
      attachment,
      confidenceThreshold: 0.6,
      leadFilters: { limit: 25 },
      engagementSignals: {
        events: engagementEvents,
        suppressionDays: 60,
      },
      grantCriteria: criteriaOverrides,
    }

    setPrompt('')
    setAttachment(undefined)
    await run(request)
  }

  const markContacted = (result: CommandDistrictResult) => {
    if (!result.district.ncesId) return
    const event: EngagementEvent = {
      ncesId: result.district.ncesId,
      eventType: 'email_sent',
      happenedAt: new Date().toISOString(),
    }
    storeEvent(event)
    setEngagementEvents((prev) => [...prev, event].slice(-500))
  }

  const loadWhyDetails = async (ncesId: string | null) => {
    if (!ncesId) return
    try {
      const details = await apiClient.getDistrictWhyDetails(ncesId, 0.6)
      setWhyOverrides((prev) => ({
        ...prev,
        [ncesId]: {
          summary: details.summary,
          excerpts: details.sourceExcerpts,
        },
      }))
    } catch {
      // Silent fallback
    }
  }

  const addToCohort = (result: CommandDistrictResult) => {
    const exists = cohort.some((item) => item.district.ncesId === result.district.ncesId)
    if (!exists) {
      const next = [...cohort, result]
      setCohort(next)
      storeCohort(next)
    }
  }

  const removeFromCohort = (ncesId: string | null) => {
    if (!ncesId) return
    const next = cohort.filter((item) => item.district.ncesId !== ncesId)
    setCohort(next)
    storeCohort(next)
  }

  const exportCohort = () => {
    downloadCsv(
      'grant-cohort.csv',
      cohort.map((item) => ({
        ncesId: item.district.ncesId,
        district: item.district.name,
        state: item.district.state,
        city: item.district.city,
        enrollment: item.district.enrollment,
        superintendentEmail: item.actions.email,
        confidence: item.why.confidence.toFixed(2),
        compositeScore: item.score.composite.toFixed(2),
      }))
    )
  }

  // Sync data response
  useEffect(() => {
    if (!data || data.generatedAt === lastResponseAt) return
    setLatestExplanation(data.explanation)
    setLatestReasoning(data.reasoning)
    setLatestResults(data.districts)
    setLatestGrantCriteria(data.grantCriteria)
    setLastResponseAt(data.generatedAt)
  }, [data, lastResponseAt])

  // Sync grant criteria overrides
  useEffect(() => {
    if (!data?.grantCriteria) return
    setCriteriaOverrides((prev) => ({ ...prev, ...data.grantCriteria }))
  }, [data?.grantCriteria])

  // Handle pre-filled query from URL
  useEffect(() => {
    const q = searchParams.get('q')
    if (q && q !== prompt) {
      setPrompt(q)
    }
  }, [searchParams])

  const cohortIds = useMemo(() => new Set(cohort.map((c) => c.district.ncesId)), [cohort])

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="min-h-full">
      {/* Landing state: centered prompt */}
      {!hasSearched && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] px-4 relative">
          <FloatingOrbs />
          <div className="w-full max-w-2xl space-y-8 relative z-10">
            {/* Hero greeting */}
            <div className="text-center space-y-2">
              <h1 className="text-heading-2 text-foreground">
                {showWelcome ? (
                  <>
                    Welcome back{firstName ? `, ${firstName}` : ''}.
                    <br />
                    <span className="text-muted-foreground">What would you like to focus on today?</span>
                  </>
                ) : (
                  'What would you like to know?'
                )}
              </h1>
            </div>

            {/* Prompt input */}
            <PromptInput
              prompt={prompt}
              setPrompt={setPrompt}
              onSubmit={() => runPrompt()}
              loading={loading}
              attachment={attachment}
              onAttach={handleAttachFile}
              onClearAttachment={() => setAttachment(undefined)}
            />

            {/* Subtext - below the prompt */}
            <p className="text-body-small text-muted-foreground max-w-lg mx-auto text-center">
              Search for leads, match districts to grants, or get strategic intelligence across 19,595 districts and 175K+ documents.
            </p>

            {/* Starter prompt grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {starterPrompts.map((item) => (
                <button
                  key={item.text}
                  type="button"
                  onClick={() => {
                    setPrompt(item.text)
                    setTimeout(() => runPrompt(item.text), 50)
                  }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left text-sm text-muted-foreground hover:text-foreground hover:border-accent/30 hover:bg-accent/5 transition-all duration-[var(--motion-fast)] group min-h-[48px]"
                >
                  <span className="text-base shrink-0">{item.icon}</span>
                  <span className="group-hover:text-foreground leading-snug">{item.text}</span>
                </button>
              ))}
            </div>

            {/* Engagement events indicator */}
            {engagementEvents.length > 0 && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  {engagementEvents.length} engagement event{engagementEvents.length !== 1 ? 's' : ''} tracked
                  <span className="mx-1">·</span>
                  Contacted districts are suppressed from lead recommendations
                  <button
                    type="button"
                    className="ml-2 text-accent hover:underline"
                    onClick={() => {
                      localStorage.removeItem(CONTACT_HISTORY_STORAGE_KEY)
                      setEngagementEvents([])
                    }}
                  >
                    Clear
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results state */}
      {(hasSearched || loading) && (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4 pb-24">
          {/* Sticky prompt bar at top */}
          <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm pb-3 -mx-4 px-4 pt-2">
            <PromptInput
              prompt={prompt}
              setPrompt={setPrompt}
              onSubmit={() => runPrompt()}
              loading={loading}
              attachment={attachment}
              onAttach={handleAttachFile}
              onClearAttachment={() => setAttachment(undefined)}
            />
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
                </div>
                <p className="text-sm text-muted-foreground">Searching and ranking districts...</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Results */}
          {!loading && latestResults.length > 0 && (
            <>
              {/* AI Summary */}
              <AISummary text={latestExplanation} grantCriteria={latestGrantCriteria} reasoning={latestReasoning} />

              {/* Grant criteria overrides */}
              {(criteriaOverrides.frplMin !== undefined || criteriaOverrides.minorityMin !== undefined) && (
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <span className="text-xs font-medium text-muted-foreground">Refine criteria:</span>
                  <label className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">FRPL &ge;</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={criteriaOverrides.frplMin ?? ''}
                      onChange={(e) =>
                        setCriteriaOverrides((prev) => ({
                          ...prev,
                          frplMin: e.target.value ? Number(e.target.value) : undefined,
                        }))
                      }
                      className="w-14 rounded-md border border-border bg-background px-2 py-1 text-xs tabular-nums"
                    />
                    <span className="text-muted-foreground">%</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Minority &ge;</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={criteriaOverrides.minorityMin ?? ''}
                      onChange={(e) =>
                        setCriteriaOverrides((prev) => ({
                          ...prev,
                          minorityMin: e.target.value ? Number(e.target.value) : undefined,
                        }))
                      }
                      className="w-14 rounded-md border border-border bg-background px-2 py-1 text-xs tabular-nums"
                    />
                    <span className="text-muted-foreground">%</span>
                  </label>
                </div>
              )}

              {/* Results count */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {latestResults.length} district{latestResults.length !== 1 ? 's' : ''} found
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Add all to cohort
                      const next = [...cohort]
                      for (const r of latestResults) {
                        if (!next.some((c) => c.district.ncesId === r.district.ncesId)) {
                          next.push(r)
                        }
                      }
                      setCohort(next)
                      storeCohort(next)
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add all to cohort
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadCsv(
                        'search-results.csv',
                        latestResults.map((r) => ({
                          rank: latestResults.indexOf(r) + 1,
                          ncesId: r.district.ncesId,
                          district: r.district.name,
                          state: r.district.state,
                          city: r.district.city,
                          enrollment: r.district.enrollment,
                          email: r.actions.email,
                          composite: r.score.composite.toFixed(2),
                          confidence: r.why.confidence.toFixed(2),
                        }))
                      )
                    }
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> Export
                  </Button>
                </div>
              </div>

              {/* District result rows */}
              <div className="space-y-2">
                {latestResults.map((result, i) => (
                  <ResultRow
                    key={result.district.ncesId || `${result.district.name}-${i}`}
                    result={result}
                    rank={i + 1}
                    isExpanded={expandedRow === (result.district.ncesId || result.district.name)}
                    onToggle={() =>
                      setExpandedRow(
                        expandedRow === (result.district.ncesId || result.district.name)
                          ? null
                          : (result.district.ncesId || result.district.name)
                      )
                    }
                    whyOverride={result.district.ncesId ? whyOverrides[result.district.ncesId] : undefined}
                    onLoadWhy={() => loadWhyDetails(result.district.ncesId)}
                    onMarkContacted={() => markContacted(result)}
                    onAddToCohort={() => addToCohort(result)}
                    onRemoveFromCohort={() => removeFromCohort(result.district.ncesId)}
                    inCohort={cohortIds.has(result.district.ncesId)}
                  />
                ))}
              </div>
            </>
          )}

          {/* Empty results */}
          {!loading && !error && hasSearched && latestResults.length === 0 && latestExplanation && (
            <AISummary text={latestExplanation} reasoning={latestReasoning} />
          )}
        </div>
      )}

      {/* Cohort tray */}
      <CohortTray
        cohort={cohort}
        onExport={exportCohort}
        onClear={() => {
          setCohort([])
          storeCohort([])
        }}
      />
    </div>
  )
}
