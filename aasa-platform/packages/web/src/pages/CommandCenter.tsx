import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, MicOff, Paperclip, Send, Sparkles } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type {
  CommandDistrictResult,
  CommandRequest,
  EngagementEvent,
  GrantCriteria,
} from '@aasa-platform/shared'
import { Button } from '../components/ui/button'
import { useCommandSearch } from '../hooks/useCommandSearch'
import { apiClient } from '../lib/api-client'

type ChatMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; results?: CommandDistrictResult[]; grantCriteria?: GrantCriteria }

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

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

export default function CommandCenter() {
  const [searchParams] = useSearchParams()
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text:
        'Ask anything: "next hottest uncontacted leads in TX", upload a grant file for criteria extraction, or click the mic and speak.',
    },
  ])
  const [attachment, setAttachment] = useState<{ filename: string; mimeType: string; textContent: string } | undefined>()
  const [isListening, setIsListening] = useState(false)
  const [whyOverrides, setWhyOverrides] = useState<Record<string, { summary: string; excerpts: Array<{ keyword: string; excerpt: string; documentUrl?: string | null }> }>>({})
  const [criteriaOverrides, setCriteriaOverrides] = useState<GrantCriteria>({})
  const [cohort, setCohort] = useState<CommandDistrictResult[]>(() => getStoredCohort())
  const [engagementEvents, setEngagementEvents] = useState<EngagementEvent[]>(() => getStoredEvents())
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { data, loading, error, run } = useCommandSearch()
  const [lastResponseAt, setLastResponseAt] = useState<string | null>(null)

  const starterPrompts = useMemo(
    () => [
      'next hottest uncontacted leads in CA and TX',
      'find grants-ready districts with FRPL > 70% and minority > 60%',
      'show districts with strong Measure What Matters evidence',
      'build a hit list of top 20 uncontacted tier 1 districts',
    ],
    []
  )

  const handleAttachFile = async (file?: File) => {
    if (!file) return
    const textContent = await file.text()
    setAttachment({
      filename: file.name,
      mimeType: file.type || 'text/plain',
      textContent: textContent.slice(0, 120_000),
    })
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
      setPrompt((prev) => (prev ? `${prev} ${transcript}`.trim() : transcript))
    }
    recognition.onerror = () => {
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
    }
    recognition.start()
  }

  const runPrompt = async (value: string) => {
    const text = value.trim()
    if (!text) return

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

    setMessages((prev) => [...prev, { role: 'user', text }])
    setPrompt('')
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
      // Silent fallback keeps existing rationale.
    }
  }

  const addToCohort = (result: CommandDistrictResult) => {
    const next = [...cohort]
    const exists = next.some((item) => item.district.ncesId === result.district.ncesId)
    if (!exists) {
      next.push(result)
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

  useEffect(() => {
    if (!data || data.generatedAt === lastResponseAt) return
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: data.explanation,
        results: data.districts,
        grantCriteria: data.grantCriteria,
      },
    ])
    setLastResponseAt(data.generatedAt)
  }, [data, lastResponseAt])

  useEffect(() => {
    if (!data?.grantCriteria) return
    setCriteriaOverrides((prev) => ({
      ...prev,
      ...data.grantCriteria,
    }))
  }, [data?.grantCriteria])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q && q !== prompt) {
      setPrompt(q)
    }
  }, [searchParams])

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-heading-3 text-foreground">AI Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Chat-first lead and grant workflows with transparent district rationale.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        {cohort.length > 0 && (
          <div className="rounded-md border border-border p-3 bg-muted/40">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Active grant cohort ({cohort.length})</p>
                <p className="text-xs text-muted-foreground">Use this as your evidence-backed hit list.</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      'grant-cohort.csv',
                      cohort.map((item) => ({
                        ncesId: item.district.ncesId,
                        district: item.district.name,
                        state: item.district.state,
                        superintendentEmail: item.actions.email,
                        confidence: item.why.confidence.toFixed(2),
                        compositeScore: item.score.composite.toFixed(2),
                      }))
                    )
                  }
                >
                  Export cohort CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCohort([])
                    storeCohort([])
                  }}
                >
                  Clear cohort
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-md border border-border p-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Engagement timeline (suppression source)</p>
              <p className="text-xs text-muted-foreground">
                Recently contacted districts are suppressed from next-hottest-uncontacted recommendations.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPrompt('Generate a weekly strategic briefing and top states by momentum')}
              >
                Run weekly briefing
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  localStorage.removeItem(CONTACT_HISTORY_STORAGE_KEY)
                  setEngagementEvents([])
                }}
              >
                Clear timeline
              </Button>
            </div>
          </div>
          <div className="mt-2 max-h-24 overflow-y-auto text-xs text-muted-foreground">
            {engagementEvents.length === 0 && <p>No engagement events tracked yet.</p>}
            {engagementEvents.slice(-8).reverse().map((event, i) => (
              <p key={`${event.ncesId}-${event.happenedAt}-${i}`}>
                {event.ncesId} • {event.eventType} • {new Date(event.happenedAt).toLocaleString()}
              </p>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {starterPrompts.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPrompt(item)}
              className="text-xs px-2 py-1 rounded-full border border-border hover:bg-accent/40"
            >
              <Sparkles className="inline h-3 w-3 mr-1" />
              {item}
            </button>
          ))}
        </div>

        <div className="space-y-3 max-h-[52vh] overflow-y-auto rounded-md border border-border p-3 bg-background">
          {messages.map((msg, idx) => (
            <div key={idx} className={msg.role === 'user' ? 'text-right' : ''}>
              <div
                className={`inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {msg.text}
              </div>

              {msg.role === 'assistant' && msg.grantCriteria && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Parsed criteria:
                  {' '}
                  {msg.grantCriteria.frplMin ? `FRPL >= ${msg.grantCriteria.frplMin}%` : 'FRPL any'}
                  {' | '}
                  {msg.grantCriteria.minorityMin
                    ? `Minority >= ${msg.grantCriteria.minorityMin}%`
                    : 'Minority any'}
                </div>
              )}

              {msg.role === 'assistant' && msg.results && msg.results.length > 0 && (
                <div className="mt-3 space-y-3">
                  {msg.results.map((result) => (
                    <article key={result.district.ncesId || result.district.name} className="rounded-md border border-border p-3 text-left bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sm">{result.district.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {result.district.state}
                            {result.district.city ? ` • ${result.district.city}` : ''}
                            {result.district.enrollment ? ` • ${result.district.enrollment.toLocaleString()} students` : ''}
                          </p>
                        </div>
                        <div className="text-xs text-right">
                          <div className="font-medium">Composite {result.score.composite.toFixed(2)}</div>
                          <div className="text-muted-foreground">
                            Confidence {formatConfidence(result.why.confidence)} ({result.why.confidenceBand})
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-xs space-y-1">
                        <div className="font-medium">Why this district</div>
                        <p className="text-muted-foreground">
                          {result.district.ncesId && whyOverrides[result.district.ncesId]
                            ? whyOverrides[result.district.ncesId].summary
                            : result.why.summary}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {result.why.topSignals.map((signal) => (
                            <span key={`${signal.category}-${signal.signal}`} className="rounded-full bg-muted px-2 py-0.5">
                              {signal.signal}: {signal.weight.toFixed(2)}
                            </span>
                          ))}
                        </div>
                        {(result.why.sourceExcerpts.length > 0 ||
                          (result.district.ncesId &&
                            whyOverrides[result.district.ncesId]?.excerpts?.length)) && (
                          <details>
                            <summary className="cursor-pointer">Evidence excerpts</summary>
                            <ul className="mt-1 space-y-1">
                              {(result.district.ncesId && whyOverrides[result.district.ncesId]
                                ? whyOverrides[result.district.ncesId].excerpts
                                : result.why.sourceExcerpts
                              ).map((ex, i) => (
                                <li key={`${result.district.ncesId}-ex-${i}`}>
                                  <span className="font-medium">{ex.keyword}</span>
                                  : {ex.excerpt}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                        <button
                          type="button"
                          className="text-xs underline text-muted-foreground"
                          onClick={() => loadWhyDetails(result.district.ncesId)}
                        >
                          Load full rationale
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {result.actions.openDistrictSite && (
                          <a
                            href={result.actions.openDistrictSite}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-2 py-1 rounded border border-border hover:bg-accent/40"
                          >
                            Open district site
                          </a>
                        )}
                        {result.actions.email && (
                          <a
                            href={`mailto:${result.actions.email}`}
                            onClick={() => markContacted(result)}
                            className="text-xs px-2 py-1 rounded border border-border hover:bg-accent/40"
                          >
                            Email contact
                          </a>
                        )}
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-accent/40"
                          onClick={() => markContacted(result)}
                        >
                          Mark contacted
                        </button>
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-accent/40"
                          onClick={() => addToCohort(result)}
                        >
                          Add to cohort
                        </button>
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded border border-border hover:bg-accent/40"
                          onClick={() => removeFromCohort(result.district.ncesId)}
                        >
                          Remove from cohort
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {attachment && (
          <div className="text-xs text-muted-foreground">
            Attached: {attachment.filename}
          </div>
        )}

        {(criteriaOverrides.frplMin !== undefined || criteriaOverrides.minorityMin !== undefined) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-md border border-border p-2">
            <label className="text-xs text-muted-foreground">
              FRPL minimum %
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
                className="mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Minority minimum %
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
                className="mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-sm"
              />
            </label>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask for leads, grant matches, or strategic insights..."
            className="flex-1 min-h-[92px] rounded-md border border-border bg-background p-2 text-sm"
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".txt,.md,.csv,.json,.pdf"
            onChange={(e) => handleAttachFile(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button type="button" variant={isListening ? 'default' : 'outline'} onClick={handleMic}>
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button type="button" onClick={() => runPrompt(prompt)} disabled={loading || !prompt.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {loading && <p className="text-xs text-muted-foreground">Thinking and ranking districts...</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  )
}

