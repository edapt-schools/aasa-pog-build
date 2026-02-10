import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Paperclip, Send, Sparkles } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useCommandSearch } from '../hooks/useCommandSearch';
import { apiClient } from '../lib/api-client';
const CONTACT_HISTORY_STORAGE_KEY = 'aasa_contact_events_v1';
const COHORT_STORAGE_KEY = 'aasa_grant_cohort_v1';
function getStoredEvents() {
    try {
        const raw = localStorage.getItem(CONTACT_HISTORY_STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function storeEvent(event) {
    const events = getStoredEvents();
    events.push(event);
    localStorage.setItem(CONTACT_HISTORY_STORAGE_KEY, JSON.stringify(events.slice(-500)));
}
function getStoredCohort() {
    try {
        const raw = localStorage.getItem(COHORT_STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function storeCohort(rows) {
    localStorage.setItem(COHORT_STORAGE_KEY, JSON.stringify(rows));
}
function downloadCsv(filename, rows) {
    if (rows.length === 0)
        return;
    const headers = Object.keys(rows[0]);
    const lines = [
        headers.join(','),
        ...rows.map((row) => headers
            .map((header) => {
            const value = row[header];
            const str = value === null || value === undefined ? '' : String(value);
            return `"${str.replace(/"/g, '""')}"`;
        })
            .join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
function formatConfidence(confidence) {
    return `${Math.round(confidence * 100)}%`;
}
export default function CommandCenter() {
    const [searchParams] = useSearchParams();
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            text: 'Ask anything: "next hottest uncontacted leads in TX", upload a grant file for criteria extraction, or click the mic and speak.',
        },
    ]);
    const [attachment, setAttachment] = useState();
    const [isListening, setIsListening] = useState(false);
    const [whyOverrides, setWhyOverrides] = useState({});
    const [criteriaOverrides, setCriteriaOverrides] = useState({});
    const [cohort, setCohort] = useState(() => getStoredCohort());
    const [engagementEvents, setEngagementEvents] = useState(() => getStoredEvents());
    const fileInputRef = useRef(null);
    const { data, loading, error, run } = useCommandSearch();
    const [lastResponseAt, setLastResponseAt] = useState(null);
    const starterPrompts = useMemo(() => [
        'next hottest uncontacted leads in CA and TX',
        'find grants-ready districts with FRPL > 70% and minority > 60%',
        'show districts with strong Measure What Matters evidence',
        'build a hit list of top 20 uncontacted tier 1 districts',
    ], []);
    const handleAttachFile = async (file) => {
        if (!file)
            return;
        const textContent = await file.text();
        setAttachment({
            filename: file.name,
            mimeType: file.type || 'text/plain',
            textContent: textContent.slice(0, 120_000),
        });
    };
    const handleMic = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Speech recognition is not available in this browser.');
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        setIsListening(true);
        recognition.onresult = (event) => {
            const transcript = event?.results?.[0]?.[0]?.transcript || '';
            setPrompt((prev) => (prev ? `${prev} ${transcript}`.trim() : transcript));
        };
        recognition.onerror = () => {
            setIsListening(false);
        };
        recognition.onend = () => {
            setIsListening(false);
        };
        recognition.start();
    };
    const runPrompt = async (value) => {
        const text = value.trim();
        if (!text)
            return;
        const request = {
            prompt: text,
            attachment,
            confidenceThreshold: 0.6,
            leadFilters: { limit: 25 },
            engagementSignals: {
                events: engagementEvents,
                suppressionDays: 60,
            },
            grantCriteria: criteriaOverrides,
        };
        setMessages((prev) => [...prev, { role: 'user', text }]);
        setPrompt('');
        await run(request);
    };
    const markContacted = (result) => {
        if (!result.district.ncesId)
            return;
        const event = {
            ncesId: result.district.ncesId,
            eventType: 'email_sent',
            happenedAt: new Date().toISOString(),
        };
        storeEvent(event);
        setEngagementEvents((prev) => [...prev, event].slice(-500));
    };
    const loadWhyDetails = async (ncesId) => {
        if (!ncesId)
            return;
        try {
            const details = await apiClient.getDistrictWhyDetails(ncesId, 0.6);
            setWhyOverrides((prev) => ({
                ...prev,
                [ncesId]: {
                    summary: details.summary,
                    excerpts: details.sourceExcerpts,
                },
            }));
        }
        catch {
            // Silent fallback keeps existing rationale.
        }
    };
    const addToCohort = (result) => {
        const next = [...cohort];
        const exists = next.some((item) => item.district.ncesId === result.district.ncesId);
        if (!exists) {
            next.push(result);
            setCohort(next);
            storeCohort(next);
        }
    };
    const removeFromCohort = (ncesId) => {
        if (!ncesId)
            return;
        const next = cohort.filter((item) => item.district.ncesId !== ncesId);
        setCohort(next);
        storeCohort(next);
    };
    useEffect(() => {
        if (!data || data.generatedAt === lastResponseAt)
            return;
        setMessages((prev) => [
            ...prev,
            {
                role: 'assistant',
                text: data.explanation,
                results: data.districts,
                grantCriteria: data.grantCriteria,
            },
        ]);
        setLastResponseAt(data.generatedAt);
    }, [data, lastResponseAt]);
    useEffect(() => {
        if (!data?.grantCriteria)
            return;
        setCriteriaOverrides((prev) => ({
            ...prev,
            ...data.grantCriteria,
        }));
    }, [data?.grantCriteria]);
    useEffect(() => {
        const q = searchParams.get('q');
        if (q && q !== prompt) {
            setPrompt(q);
        }
    }, [searchParams]);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("header", { className: "space-y-1", children: [_jsx("h1", { className: "text-heading-3 text-foreground", children: "AI Command Center" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Chat-first lead and grant workflows with transparent district rationale." })] }), _jsxs("div", { className: "rounded-lg border border-border bg-card p-4 space-y-3", children: [cohort.length > 0 && (_jsx("div", { className: "rounded-md border border-border p-3 bg-muted/40", children: _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-sm font-medium", children: ["Active grant cohort (", cohort.length, ")"] }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Use this as your evidence-backed hit list." })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => downloadCsv('grant-cohort.csv', cohort.map((item) => ({
                                                ncesId: item.district.ncesId,
                                                district: item.district.name,
                                                state: item.district.state,
                                                superintendentEmail: item.actions.email,
                                                confidence: item.why.confidence.toFixed(2),
                                                compositeScore: item.score.composite.toFixed(2),
                                            }))), children: "Export cohort CSV" }), _jsx(Button, { type: "button", variant: "outline", onClick: () => {
                                                setCohort([]);
                                                storeCohort([]);
                                            }, children: "Clear cohort" })] })] }) })), _jsxs("div", { className: "rounded-md border border-border p-3 bg-muted/30", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium", children: "Engagement timeline (suppression source)" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Recently contacted districts are suppressed from next-hottest-uncontacted recommendations." })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setPrompt('Generate a weekly strategic briefing and top states by momentum'), children: "Run weekly briefing" }), _jsx(Button, { type: "button", variant: "outline", onClick: () => {
                                                    localStorage.removeItem(CONTACT_HISTORY_STORAGE_KEY);
                                                    setEngagementEvents([]);
                                                }, children: "Clear timeline" })] })] }), _jsxs("div", { className: "mt-2 max-h-24 overflow-y-auto text-xs text-muted-foreground", children: [engagementEvents.length === 0 && _jsx("p", { children: "No engagement events tracked yet." }), engagementEvents.slice(-8).reverse().map((event, i) => (_jsxs("p", { children: [event.ncesId, " \u2022 ", event.eventType, " \u2022 ", new Date(event.happenedAt).toLocaleString()] }, `${event.ncesId}-${event.happenedAt}-${i}`)))] })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: starterPrompts.map((item) => (_jsxs("button", { type: "button", onClick: () => setPrompt(item), className: "text-xs px-2 py-1 rounded-full border border-border hover:bg-accent/40", children: [_jsx(Sparkles, { className: "inline h-3 w-3 mr-1" }), item] }, item))) }), _jsx("div", { className: "space-y-3 max-h-[52vh] overflow-y-auto rounded-md border border-border p-3 bg-background", children: messages.map((msg, idx) => (_jsxs("div", { className: msg.role === 'user' ? 'text-right' : '', children: [_jsx("div", { className: `inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user'
                                        ? 'bg-accent text-accent-foreground'
                                        : 'bg-muted text-foreground'}`, children: msg.text }), msg.role === 'assistant' && msg.grantCriteria && (_jsxs("div", { className: "mt-2 text-xs text-muted-foreground", children: ["Parsed criteria:", ' ', msg.grantCriteria.frplMin ? `FRPL >= ${msg.grantCriteria.frplMin}%` : 'FRPL any', ' | ', msg.grantCriteria.minorityMin
                                            ? `Minority >= ${msg.grantCriteria.minorityMin}%`
                                            : 'Minority any'] })), msg.role === 'assistant' && msg.results && msg.results.length > 0 && (_jsx("div", { className: "mt-3 space-y-3", children: msg.results.map((result) => (_jsxs("article", { className: "rounded-md border border-border p-3 text-left bg-card", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-sm", children: result.district.name }), _jsxs("p", { className: "text-xs text-muted-foreground", children: [result.district.state, result.district.city ? ` • ${result.district.city}` : '', result.district.enrollment ? ` • ${result.district.enrollment.toLocaleString()} students` : ''] })] }), _jsxs("div", { className: "text-xs text-right", children: [_jsxs("div", { className: "font-medium", children: ["Composite ", result.score.composite.toFixed(2)] }), _jsxs("div", { className: "text-muted-foreground", children: ["Confidence ", formatConfidence(result.why.confidence), " (", result.why.confidenceBand, ")"] })] })] }), _jsxs("div", { className: "mt-2 text-xs space-y-1", children: [_jsx("div", { className: "font-medium", children: "Why this district" }), _jsx("p", { className: "text-muted-foreground", children: result.district.ncesId && whyOverrides[result.district.ncesId]
                                                            ? whyOverrides[result.district.ncesId].summary
                                                            : result.why.summary }), _jsx("div", { className: "flex flex-wrap gap-1", children: result.why.topSignals.map((signal) => (_jsxs("span", { className: "rounded-full bg-muted px-2 py-0.5", children: [signal.signal, ": ", signal.weight.toFixed(2)] }, `${signal.category}-${signal.signal}`))) }), (result.why.sourceExcerpts.length > 0 ||
                                                        (result.district.ncesId &&
                                                            whyOverrides[result.district.ncesId]?.excerpts?.length)) && (_jsxs("details", { children: [_jsx("summary", { className: "cursor-pointer", children: "Evidence excerpts" }), _jsx("ul", { className: "mt-1 space-y-1", children: (result.district.ncesId && whyOverrides[result.district.ncesId]
                                                                    ? whyOverrides[result.district.ncesId].excerpts
                                                                    : result.why.sourceExcerpts).map((ex, i) => (_jsxs("li", { children: [_jsx("span", { className: "font-medium", children: ex.keyword }), ": ", ex.excerpt] }, `${result.district.ncesId}-ex-${i}`))) })] })), _jsx("button", { type: "button", className: "text-xs underline text-muted-foreground", onClick: () => loadWhyDetails(result.district.ncesId), children: "Load full rationale" })] }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [result.actions.openDistrictSite && (_jsx("a", { href: result.actions.openDistrictSite, target: "_blank", rel: "noreferrer", className: "text-xs px-2 py-1 rounded border border-border hover:bg-accent/40", children: "Open district site" })), result.actions.email && (_jsx("a", { href: `mailto:${result.actions.email}`, onClick: () => markContacted(result), className: "text-xs px-2 py-1 rounded border border-border hover:bg-accent/40", children: "Email contact" })), _jsx("button", { type: "button", className: "text-xs px-2 py-1 rounded border border-border hover:bg-accent/40", onClick: () => markContacted(result), children: "Mark contacted" }), _jsx("button", { type: "button", className: "text-xs px-2 py-1 rounded border border-border hover:bg-accent/40", onClick: () => addToCohort(result), children: "Add to cohort" }), _jsx("button", { type: "button", className: "text-xs px-2 py-1 rounded border border-border hover:bg-accent/40", onClick: () => removeFromCohort(result.district.ncesId), children: "Remove from cohort" })] })] }, result.district.ncesId || result.district.name))) }))] }, idx))) }), attachment && (_jsxs("div", { className: "text-xs text-muted-foreground", children: ["Attached: ", attachment.filename] })), (criteriaOverrides.frplMin !== undefined || criteriaOverrides.minorityMin !== undefined) && (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-2 rounded-md border border-border p-2", children: [_jsxs("label", { className: "text-xs text-muted-foreground", children: ["FRPL minimum %", _jsx("input", { type: "number", min: 0, max: 100, value: criteriaOverrides.frplMin ?? '', onChange: (e) => setCriteriaOverrides((prev) => ({
                                            ...prev,
                                            frplMin: e.target.value ? Number(e.target.value) : undefined,
                                        })), className: "mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-sm" })] }), _jsxs("label", { className: "text-xs text-muted-foreground", children: ["Minority minimum %", _jsx("input", { type: "number", min: 0, max: 100, value: criteriaOverrides.minorityMin ?? '', onChange: (e) => setCriteriaOverrides((prev) => ({
                                            ...prev,
                                            minorityMin: e.target.value ? Number(e.target.value) : undefined,
                                        })), className: "mt-1 block w-full rounded border border-border bg-background px-2 py-1 text-sm" })] })] })), _jsxs("div", { className: "flex items-end gap-2", children: [_jsx("textarea", { value: prompt, onChange: (e) => setPrompt(e.target.value), placeholder: "Ask for leads, grant matches, or strategic insights...", className: "flex-1 min-h-[92px] rounded-md border border-border bg-background p-2 text-sm" }), _jsx("input", { ref: fileInputRef, type: "file", className: "hidden", accept: ".txt,.md,.csv,.json,.pdf", onChange: (e) => handleAttachFile(e.target.files?.[0]) }), _jsx(Button, { type: "button", variant: "outline", onClick: () => fileInputRef.current?.click(), children: _jsx(Paperclip, { className: "h-4 w-4" }) }), _jsx(Button, { type: "button", variant: isListening ? 'default' : 'outline', onClick: handleMic, children: isListening ? _jsx(MicOff, { className: "h-4 w-4" }) : _jsx(Mic, { className: "h-4 w-4" }) }), _jsx(Button, { type: "button", onClick: () => runPrompt(prompt), disabled: loading || !prompt.trim(), children: _jsx(Send, { className: "h-4 w-4" }) })] }), loading && _jsx("p", { className: "text-xs text-muted-foreground", children: "Thinking and ranking districts..." }), error && _jsx("p", { className: "text-xs text-red-500", children: error })] })] }));
}
