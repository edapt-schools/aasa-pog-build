import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Bookmark,
  FolderOpen,
  Trash2,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { useSearchParams, useBlocker } from 'react-router-dom'
import type {
  CommandDistrictResult,
  CommandRequest,
  EngagementEvent,
  GrantCriteria,
  SavedCohort,
  SavedSearchRecord,
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

/** Tooltip descriptions for score signals */
const SIGNAL_TOOLTIPS: Record<string, string> = {
  semantic_max: 'Highest semantic similarity between your query and this district\'s documents (0-1 scale). Higher means the district\'s content closely matches your search.',
  readiness_score: 'District readiness for change based on strategic plans, needs assessments, and improvement indicators (0-10 scale).',
  alignment_score: 'Alignment between district priorities and your offering based on document analysis (0-10 scale).',
  activation_score: 'Active engagement signals like RFPs, grant applications, and procurement activity (0-10 scale).',
  branding_score: 'District investment in communications, branding, and public engagement (0-10 scale).',
  total_score: 'Aggregate keyword relevance score across all four categories (0-40 scale).',
}

const SCORE_TOOLTIPS: Record<string, string> = {
  Readiness: 'Measures how prepared this district is for change. Looks for strategic plans, needs assessments, portrait of a graduate, and improvement indicators.',
  Alignment: 'Measures how well this district\'s priorities align with competency-based education. Looks for instructional frameworks, curriculum standards, and educator development.',
  Activation: 'Measures active engagement signals. Looks for RFPs, grant applications, procurement activity, and performance assessment evidence.',
  Branding: 'Measures investment in communications. Looks for strategic storytelling, community engagement, content marketing, and public relations.',
}

/** Tooltip wrapper */
function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const ref = useRef<HTMLSpanElement>(null)

  const handleEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 6, left: Math.max(8, rect.left + rect.width / 2 - 140) })
    }
    setShow(true)
  }

  return (
    <span
      ref={ref}
      className="relative cursor-help"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
      onFocus={handleEnter}
      onBlur={() => setShow(false)}
      tabIndex={0}
    >
      {children}
      {show && (
        <span
          className="fixed z-50 max-w-[280px] rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground leading-relaxed shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
        </span>
      )}
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
  whyLoading,
  whyError,
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
  whyLoading?: boolean
  whyError?: string | null
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

          {/* Signal tags with tooltips */}
          {result.why.topSignals.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.why.topSignals.map((signal) => (
                <Tooltip
                  key={`${signal.category}-${signal.signal}`}
                  text={SIGNAL_TOOLTIPS[signal.signal] || `${signal.signal}: ${signal.reason || 'Score contribution signal'}`}
                >
                  <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                    {signal.signal.replace(/_/g, ' ')}
                    <span className="opacity-60">{signal.weight.toFixed(1)}</span>
                  </span>
                </Tooltip>
              ))}
            </div>
          )}

          {/* Evidence excerpts with source links */}
          {((why as any).sourceExcerpts?.length > 0 || (whyOverride?.excerpts?.length ?? 0) > 0) && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Evidence
              </h4>
              <div className="space-y-2">
                {(whyOverride?.excerpts || (why as any).sourceExcerpts || []).slice(0, 5).map((ex: any, i: number) => (
                  <div key={`${d.ncesId}-ex-${i}`} className="rounded-lg bg-background border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-accent">{ex.keyword?.replace(/_/g, ' ')}</span>
                      {ex.documentUrl ? (
                        <a
                          href={ex.documentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-accent shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" /> View source
                        </a>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50 shrink-0">No source link</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">{ex.excerpt}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Load full rationale link with loading/error states */}
          {!whyOverride && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs text-accent hover:underline font-medium disabled:opacity-50"
                disabled={whyLoading}
                onClick={(e) => { e.stopPropagation(); onLoadWhy() }}
              >
                {whyLoading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading rationale...
                  </span>
                ) : (
                  <>Load full rationale &rarr;</>
                )}
              </button>
              {whyError && (
                <span className="text-xs text-destructive">{whyError}</span>
              )}
            </div>
          )}

          {/* Score breakdown with tooltips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Readiness', value: result.score.readiness },
              { label: 'Alignment', value: result.score.alignment },
              { label: 'Activation', value: result.score.activation },
              { label: 'Branding', value: result.score.branding },
            ].map((s) => (
              <Tooltip key={s.label} text={SCORE_TOOLTIPS[s.label] || s.label}>
                <div className="text-center block">
                  <div className="text-lg font-semibold text-foreground tabular-nums">{s.value?.toFixed(1) ?? '—'}</div>
                  <div className="text-[11px] text-muted-foreground">{s.label}</div>
                </div>
              </Tooltip>
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
            {(result.district.superintendentEmail || result.actions.email) && (
              <a
                href={`mailto:${result.district.superintendentEmail || result.actions.email}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors min-h-[36px]"
                onClick={(e) => { e.stopPropagation(); onMarkContacted() }}
              >
                <Mail className="w-3.5 h-3.5" /> {result.district.superintendentEmail || result.actions.email}
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

/** Cohort tray at bottom - now with naming and server-side persistence */
function CohortTray({
  cohort,
  activeCohort,
  cohortList,
  onExport,
  onClear,
  onSaveCohort,
  onSelectCohort,
  onCreateCohort,
  cohortSaving,
}: {
  cohort: CommandDistrictResult[]
  activeCohort: SavedCohort | null
  cohortList: SavedCohort[]
  onExport: () => void
  onClear: () => void
  onSaveCohort: () => void
  onSelectCohort: (cohort: SavedCohort) => void
  onCreateCohort: () => void
  cohortSaving: boolean
}) {
  const [showCohortPicker, setShowCohortPicker] = useState(false)

  if (cohort.length === 0 && cohortList.length === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border shadow-lg">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">
              {cohort.length}
            </div>
            <span className="text-sm font-medium text-foreground">
              {activeCohort ? activeCohort.name : 'Unsaved cohort'}
            </span>
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
          {/* Cohort picker */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCohortPicker(!showCohortPicker)}
              className="text-muted-foreground"
            >
              <FolderOpen className="w-3.5 h-3.5 mr-1.5" /> My Cohorts
              {cohortList.length > 0 && (
                <span className="ml-1 text-[10px] bg-muted rounded-full px-1.5">{cohortList.length}</span>
              )}
            </Button>
            {showCohortPicker && (
              <div className="absolute bottom-full right-0 mb-2 w-72 rounded-lg border border-border bg-card shadow-xl overflow-hidden">
                <div className="p-2 border-b border-border">
                  <button
                    type="button"
                    onClick={() => { onCreateCohort(); setShowCohortPicker(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/10 rounded-md"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create new cohort
                  </button>
                </div>
                {cohortList.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto p-1">
                    {cohortList.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { onSelectCohort(c); setShowCohortPicker(false) }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-md hover:bg-muted/50 ${
                          activeCohort?.id === c.id ? 'bg-accent/10 text-accent' : 'text-foreground'
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">{c.itemCount ?? 0}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-xs text-muted-foreground text-center">No saved cohorts yet</div>
                )}
              </div>
            )}
          </div>

          {/* Save cohort */}
          {cohort.length > 0 && (
            <Button variant="outline" size="sm" onClick={onSaveCohort} disabled={cohortSaving}>
              {cohortSaving ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Bookmark className="w-3.5 h-3.5 mr-1.5" />
              )}
              {activeCohort ? 'Update' : 'Save'}
            </Button>
          )}

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

/** Modal component */
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl p-6 mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Navigation Guard Modal */
function UnsavedChangesModal({
  open,
  onSaveAndLeave,
  onLeave,
  onCancel,
  saving,
}: {
  open: boolean
  onSaveAndLeave: () => void
  onLeave: () => void
  onCancel: () => void
  saving: boolean
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl p-6 mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Unsaved search results</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Your search results will be lost if you leave.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="outline" size="sm" onClick={onLeave}>Leave without saving</Button>
          <Button variant="default" size="sm" onClick={onSaveAndLeave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5 mr-1.5" />}
            Save & Leave
          </Button>
        </div>
      </div>
    </div>
  )
}


/** Floating orbs — AASA brand navy #173054 + red #C41E3A
 *  Three orbs drift slowly in separate zones so they never overlap.
 *  Each orb smoothly transitions between navy and red on a staggered
 *  8-second cadence so there's always a mix of both colors on screen. */
function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0" aria-hidden="true">
      <div className="absolute rounded-full aasa-orb aasa-orb-1" />
      <div className="absolute rounded-full aasa-orb aasa-orb-2" />
      <div className="absolute rounded-full aasa-orb aasa-orb-3" />

      <style>{`
        .aasa-orb {
          opacity: 0.15;
        }

        /* ── Orb 1: top-left zone ───────────────── */
        .aasa-orb-1 {
          width: 420px; height: 420px;
          filter: blur(80px);
          top: 5%; left: 5%;
          animation:
            orb1-drift 32s ease-in-out infinite,
            orb1-color 8s ease-in-out infinite;
        }

        /* ── Orb 2: center-right zone ───────────── */
        .aasa-orb-2 {
          width: 380px; height: 380px;
          filter: blur(70px);
          top: 35%; right: 5%; left: auto;
          animation:
            orb2-drift 28s ease-in-out infinite,
            orb2-color 8s ease-in-out infinite;
          animation-delay: 0s, -2.67s;
        }

        /* ── Orb 3: bottom-left zone ────────────── */
        .aasa-orb-3 {
          width: 360px; height: 360px;
          filter: blur(65px);
          bottom: 5%; left: 25%; top: auto;
          animation:
            orb3-drift 35s ease-in-out infinite,
            orb3-color 8s ease-in-out infinite;
          animation-delay: 0s, -5.33s;
        }

        /* ── Color transitions: navy ↔ red ──────── */
        /* Each orb cycles through the same keyframes but with
           staggered animation-delay (-2.67s apart = 8s / 3)
           so at any moment the three orbs show different hues. */

        @keyframes orb1-color {
          0%, 100% { background: #173054; }
          50%      { background: #C41E3A; }
        }
        @keyframes orb2-color {
          0%, 100% { background: #173054; }
          50%      { background: #C41E3A; }
        }
        @keyframes orb3-color {
          0%, 100% { background: #173054; }
          50%      { background: #C41E3A; }
        }

        /* ── Drift paths: each orb stays in its zone ── */
        /* Orb 1 roams the top-left quadrant */
        @keyframes orb1-drift {
          0%   { transform: translate(0, 0); }
          25%  { transform: translate(8vw, 6vh); }
          50%  { transform: translate(3vw, 12vh); }
          75%  { transform: translate(12vw, 3vh); }
          100% { transform: translate(0, 0); }
        }

        /* Orb 2 roams the center-right area */
        @keyframes orb2-drift {
          0%   { transform: translate(0, 0); }
          20%  { transform: translate(-6vw, 8vh); }
          45%  { transform: translate(-10vw, -4vh); }
          70%  { transform: translate(-3vw, 10vh); }
          100% { transform: translate(0, 0); }
        }

        /* Orb 3 roams the bottom-center area */
        @keyframes orb3-drift {
          0%   { transform: translate(0, 0); }
          30%  { transform: translate(10vw, -6vh); }
          60%  { transform: translate(-5vw, -8vh); }
          100% { transform: translate(0, 0); }
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
  const [whyLoadingIds, setWhyLoadingIds] = useState<Set<string>>(new Set())
  const [whyErrors, setWhyErrors] = useState<Record<string, string>>({})
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

  // Cohort management state
  const [activeCohort, setActiveCohort] = useState<SavedCohort | null>(null)
  const [cohortList, setCohortList] = useState<SavedCohort[]>([])
  const [cohortSaving, setCohortSaving] = useState(false)
  const [showCohortNameModal, setShowCohortNameModal] = useState(false)
  const [cohortNameInput, setCohortNameInput] = useState('')
  const [pendingCohortAction, setPendingCohortAction] = useState<'create' | 'save' | null>(null)

  // Saved searches state
  const [savedSearches, setSavedSearches] = useState<SavedSearchRecord[]>([])
  const [showSaveSearchModal, setShowSaveSearchModal] = useState(false)
  const [searchNameInput, setSearchNameInput] = useState('')
  const [searchSaving, setSearchSaving] = useState(false)
  const [showSavedSearches, setShowSavedSearches] = useState(false)
  const [searchIsSaved, setSearchIsSaved] = useState(false)

  // Navigation guard state
  const [navGuardSaving, setNavGuardSaving] = useState(false)
  const hasUnsavedResults = hasSearched && latestResults.length > 0 && !searchIsSaved

  // Welcome-back state: read once (pure), write timestamp in effect
  const [showWelcome] = useState(() => shouldShowWelcome())
  const firstName = useMemo(() => extractFirstName(user?.email), [user?.email])

  useEffect(() => {
    // Stamp the visit timestamp (side-effect, safe from Strict Mode double-render)
    localStorage.setItem(WELCOME_BACK_KEY, String(Date.now()))
  }, [])

  // Load user's cohorts from server
  useEffect(() => {
    apiClient.listCohorts().then((res) => setCohortList(res.cohorts)).catch(() => {})
  }, [])

  // Load user's saved searches from server
  useEffect(() => {
    apiClient.listSavedSearches().then((res) => setSavedSearches(res.searches)).catch(() => {})
  }, [])

  // Navigation guard (React Router)
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) =>
        hasUnsavedResults && currentLocation.pathname !== nextLocation.pathname,
      [hasUnsavedResults]
    )
  )

  // Browser beforeunload guard
  useEffect(() => {
    if (!hasUnsavedResults) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedResults])

  // Handle save-and-leave from navigation guard
  const handleSaveAndLeave = async () => {
    setNavGuardSaving(true)
    try {
      const lastQuery = latestResults.length > 0 ? prompt || 'Unnamed search' : ''
      await apiClient.saveSearch({
        name: `Search: ${lastQuery.slice(0, 50)}`,
        query: lastQuery,
        resultCount: latestResults.length,
      })
      setSearchIsSaved(true)
      // Refresh saved searches
      apiClient.listSavedSearches().then((res) => setSavedSearches(res.searches)).catch(() => {})
      // Let the blocker proceed after saving
      setTimeout(() => blocker.proceed?.(), 100)
    } catch {
      // Still proceed even if save fails
      blocker.proceed?.()
    } finally {
      setNavGuardSaving(false)
    }
  }

  // Cohort save handler
  const handleSaveCohort = async () => {
    if (activeCohort) {
      // Update existing: add any new districts
      setCohortSaving(true)
      try {
        const ncesIds = cohort.map((c) => c.district.ncesId).filter(Boolean) as string[]
        await apiClient.addDistrictsToCohort(activeCohort.id, ncesIds)
        apiClient.listCohorts().then((res) => setCohortList(res.cohorts)).catch(() => {})
      } catch {}
      setCohortSaving(false)
    } else {
      // Show name modal for new cohort
      setCohortNameInput('')
      setPendingCohortAction('save')
      setShowCohortNameModal(true)
    }
  }

  const handleCreateCohort = () => {
    setCohortNameInput('')
    setPendingCohortAction('create')
    setShowCohortNameModal(true)
  }

  const handleCohortNameSubmit = async () => {
    if (!cohortNameInput.trim()) return
    setCohortSaving(true)
    try {
      const newCohort = await apiClient.createCohort(cohortNameInput.trim())
      if (pendingCohortAction === 'save' && cohort.length > 0) {
        const ncesIds = cohort.map((c) => c.district.ncesId).filter(Boolean) as string[]
        await apiClient.addDistrictsToCohort(newCohort.id, ncesIds)
      }
      setActiveCohort(newCohort)
      apiClient.listCohorts().then((res) => setCohortList(res.cohorts)).catch(() => {})
    } catch {}
    setCohortSaving(false)
    setShowCohortNameModal(false)
  }

  const handleSelectCohort = async (c: SavedCohort) => {
    try {
      const detail = await apiClient.getCohortDetail(c.id)
      setActiveCohort(c)
      // Load cohort items as CommandDistrictResult stubs for the local cohort state
      const items: CommandDistrictResult[] = (detail.cohort.items || [])
        .filter((item) => item.district)
        .map((item) => ({
          district: item.district!,
          score: { total: 0, readiness: 0, alignment: 0, activation: 0, branding: 0, composite: 0 },
          why: {
            ncesId: item.ncesId,
            confidence: 0,
            confidenceBand: 'low' as const,
            summary: '',
            topSignals: [],
            sourceExcerpts: [],
          },
          actions: {
            email: item.district?.superintendentEmail || null,
            openDistrictSite: item.district?.websiteDomain ? `https://${item.district.websiteDomain}` : null,
            ncesId: item.ncesId,
          },
        }))
      setCohort(items)
      storeCohort(items)
    } catch {}
  }

  // Save search handler
  const handleSaveSearch = async () => {
    if (!searchNameInput.trim()) return
    setSearchSaving(true)
    try {
      await apiClient.saveSearch({
        name: searchNameInput.trim(),
        query: prompt || latestExplanation,
        resultCount: latestResults.length,
      })
      setSearchIsSaved(true)
      apiClient.listSavedSearches().then((res) => setSavedSearches(res.searches)).catch(() => {})
    } catch {}
    setSearchSaving(false)
    setShowSaveSearchModal(false)
  }

  const handleDeleteSavedSearch = async (id: string) => {
    try {
      await apiClient.deleteSavedSearch(id)
      setSavedSearches((prev) => prev.filter((s) => s.id !== id))
    } catch {}
  }

  const handleRunSavedSearch = (search: SavedSearchRecord) => {
    setPrompt(search.query)
    setShowSavedSearches(false)
    setTimeout(() => runPrompt(search.query), 50)
  }

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
    setSearchIsSaved(false)

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
    setWhyLoadingIds((prev) => new Set(prev).add(ncesId))
    setWhyErrors((prev) => { const next = { ...prev }; delete next[ncesId]; return next })
    try {
      const details = await apiClient.getDistrictWhyDetails(ncesId, 0.6)
      setWhyOverrides((prev) => ({
        ...prev,
        [ncesId]: {
          summary: details.summary,
          excerpts: details.sourceExcerpts,
        },
      }))
    } catch (err: any) {
      setWhyErrors((prev) => ({
        ...prev,
        [ncesId]: err?.message || 'Failed to load rationale',
      }))
    } finally {
      setWhyLoadingIds((prev) => { const next = new Set(prev); next.delete(ncesId); return next })
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
        'NCES ID': item.district.ncesId,
        'District': item.district.name,
        'State': item.district.state,
        'City': item.district.city,
        'Enrollment': item.district.enrollment,
        'Superintendent': item.district.superintendentName,
        'Email': item.district.superintendentEmail || item.actions.email,
        'Phone': item.district.phone,
        'Website': item.actions.openDistrictSite,
        'Composite Score (0-10)': item.score.composite.toFixed(2),
        'Confidence (0-1)': item.why.confidence.toFixed(2),
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

              {/* Results count + actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground">
                    {latestResults.length} district{latestResults.length !== 1 ? 's' : ''} found
                  </p>
                  {searchIsSaved ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3 h-3" /> Saved
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSearchNameInput(''); setShowSaveSearchModal(true) }}
                      className="text-accent"
                    >
                      <Bookmark className="w-3.5 h-3.5 mr-1" /> Save search
                    </Button>
                  )}
                </div>
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
                        latestResults.map((r, idx) => ({
                          'Rank': idx + 1,
                          'NCES ID': r.district.ncesId,
                          'District': r.district.name,
                          'State': r.district.state,
                          'City': r.district.city,
                          'Enrollment': r.district.enrollment,
                          'Superintendent': r.district.superintendentName,
                          'Email': r.district.superintendentEmail || r.actions.email,
                          'Phone': r.district.phone,
                          'Website': r.actions.openDistrictSite,
                          'Composite Score (0-10)': r.score.composite.toFixed(2),
                          'Readiness (0-10)': r.score.readiness.toFixed(2),
                          'Alignment (0-10)': r.score.alignment.toFixed(2),
                          'Activation (0-10)': r.score.activation.toFixed(2),
                          'Branding (0-10)': r.score.branding.toFixed(2),
                          'Confidence (0-1)': r.why.confidence.toFixed(2),
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
                    whyLoading={result.district.ncesId ? whyLoadingIds.has(result.district.ncesId) : false}
                    whyError={result.district.ncesId ? whyErrors[result.district.ncesId] || null : null}
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
        activeCohort={activeCohort}
        cohortList={cohortList}
        onExport={exportCohort}
        onClear={() => {
          setCohort([])
          storeCohort([])
          setActiveCohort(null)
        }}
        onSaveCohort={handleSaveCohort}
        onSelectCohort={handleSelectCohort}
        onCreateCohort={handleCreateCohort}
        cohortSaving={cohortSaving}
      />

      {/* Saved searches panel (accessible from landing page) */}
      {!hasSearched && !loading && savedSearches.length > 0 && (
        <div className="fixed bottom-4 right-4 z-20">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSavedSearches(!showSavedSearches)}
              className="shadow-lg"
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" /> Saved Searches
              <span className="ml-1 text-[10px] bg-accent/10 text-accent rounded-full px-1.5">{savedSearches.length}</span>
            </Button>
            {showSavedSearches && (
              <div className="absolute bottom-full right-0 mb-2 w-80 rounded-lg border border-border bg-card shadow-xl overflow-hidden">
                <div className="p-3 border-b border-border">
                  <h4 className="text-xs font-semibold text-foreground">Saved Searches</h4>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {savedSearches.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-0"
                    >
                      <button
                        type="button"
                        onClick={() => handleRunSavedSearch(s)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="text-xs font-medium text-foreground truncate">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.query}</div>
                        <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {s.resultCount != null ? `${s.resultCount} results` : ''}
                          {' · '}
                          {new Date(s.createdAt).toLocaleDateString()}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedSearch(s.id)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive shrink-0 ml-2"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cohort name modal */}
      <Modal
        open={showCohortNameModal}
        onClose={() => setShowCohortNameModal(false)}
        title={pendingCohortAction === 'create' ? 'Create New Cohort' : 'Save Cohort'}
      >
        <div className="space-y-3">
          <input
            type="text"
            placeholder="e.g., Q1 Texas Outreach, Grant-Ready Districts..."
            value={cohortNameInput}
            onChange={(e) => setCohortNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCohortNameSubmit()}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowCohortNameModal(false)}>Cancel</Button>
            <Button variant="default" size="sm" onClick={handleCohortNameSubmit} disabled={cohortSaving || !cohortNameInput.trim()}>
              {cohortSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              {pendingCohortAction === 'create' ? 'Create' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Save search modal */}
      <Modal
        open={showSaveSearchModal}
        onClose={() => setShowSaveSearchModal(false)}
        title="Save Search"
      >
        <div className="space-y-3">
          <input
            type="text"
            placeholder="e.g., TX Tier 1 Districts, Grant FRPL 70%..."
            value={searchNameInput}
            onChange={(e) => setSearchNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveSearch()}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Saving "{prompt || 'search'}" with {latestResults.length} result{latestResults.length !== 1 ? 's' : ''}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowSaveSearchModal(false)}>Cancel</Button>
            <Button variant="default" size="sm" onClick={handleSaveSearch} disabled={searchSaving || !searchNameInput.trim()}>
              {searchSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5 mr-1.5" />}
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Navigation guard modal */}
      <UnsavedChangesModal
        open={blocker.state === 'blocked'}
        onSaveAndLeave={handleSaveAndLeave}
        onLeave={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
        saving={navGuardSaving}
      />
    </div>
  )
}
