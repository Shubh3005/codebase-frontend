"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  GitBranch,
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Terminal,
  Zap,
  Lock,
  Globe,
} from "lucide-react"
import { cn } from "@/lib/utils"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001"

function apiFetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "ngrok-skip-browser-warning": "true",
    },
  })
}

const GITHUB_REPO_RE = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/

type StepStatus = "pending" | "active" | "complete" | "failed"

type Step = {
  id: string
  label: string
  detail: string
  status: StepStatus
}

type IngestResponse = { job_id: string; repo_id: string; status: string }
type JobResponse = {
  job_id: string
  repo_id?: string
  status: "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED"
  step?: string        // "cloning" | "parsing" | "embedding" | "indexing"
  progress?: number   // 0-100
  error_message?: string | null
}

const STEPS: Step[] = [
  { id: "cloning",   label: "Cloning",   detail: "Fetching repository from GitHub",      status: "pending" },
  { id: "parsing",   label: "Parsing",   detail: "Analyzing code structure and symbols",  status: "pending" },
  { id: "embedding", label: "Embedding", detail: "Generating semantic vector embeddings", status: "pending" },
  { id: "indexing",  label: "Indexing",  detail: "Building searchable knowledge index",   status: "pending" },
  { id: "ready",     label: "Ready",     detail: "Your codebase is ready to explore",     status: "pending" },
]

// Backend sends step: "cloning" | "parsing" | "embedding" | "indexing"
const STEP_INDEX: Record<string, number> = {
  cloning: 0, parsing: 1, embedding: 2, indexing: 3,
}

const MAX_NETWORK_RETRIES = 3
const MAX_POLL_MS = 5 * 60 * 1000

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "complete")
    return <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
  if (status === "active")
    return (
      <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin-slow shrink-0" />
    )
  if (status === "failed")
    return <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
  return <Circle className="w-5 h-5 text-zinc-600 shrink-0" />
}

export default function IngestPage() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [steps, setSteps] = useState<Step[]>(STEPS)
  const [error, setError] = useState<string | null>(null)
  const [showProgress, setShowProgress] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Captured immediately from the ingest response so navigation never depends on the poll
  const repoIdRef = useRef<string | null>(null)
  // SF1: consecutive network-error count; resets on any successful HTTP response
  const networkErrorCountRef = useRef(0)
  // SF2: wall-clock time polling started, used to enforce a 5-minute hard cap
  const pollStartRef = useRef<number | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const pollJob = useCallback(
    async (id: string) => {
      // SF2: bail out if polling has exceeded the 5-minute cap
      if (pollStartRef.current !== null && Date.now() - pollStartRef.current > MAX_POLL_MS) {
        stopPolling()
        setError("This is taking longer than expected. You can refresh and re-enter the URL to try again.")
        setIsAnalyzing(false)
        return
      }

      try {
        const res = await apiFetch(`${API_BASE}/api/repos/jobs/${id}`)
        if (!res.ok) throw new Error(`Status ${res.status}`)
        const data: JobResponse = await res.json()

        // SF1: successful HTTP response resets the consecutive-error counter
        networkErrorCountRef.current = 0

        if (data.status === "FAILED") {
          stopPolling()
          setError(data.error_message ?? "Analysis failed. Please try again.")
          setIsAnalyzing(false)
          setSteps((prev) =>
            prev.map((s) => (s.status === "active" ? { ...s, status: "failed" } : s))
          )
          return
        }

        if (data.status === "COMPLETE") {
          stopPolling()
          setSteps((prev) => prev.map((s) => ({ ...s, status: "complete" })))
          // Prefer the repo_id captured at ingest time; fall back to the poll field
          const targetId = repoIdRef.current ?? data.repo_id
          if (targetId) setTimeout(() => router.push(`/${targetId}`), 900)
          return
        }

        // QUEUED/PROCESSING — use the `step` field to show which pipeline stage is active
        if (data.step) {
          const activeIdx = STEP_INDEX[data.step] ?? -1
          setSteps((prev) =>
            prev.map((s, i) => ({
              ...s,
              status:
                i < activeIdx ? "complete" : i === activeIdx ? "active" : "pending",
            }))
          )
        }
      } catch {
        // SF1: only surface the error after 3 consecutive network failures
        networkErrorCountRef.current += 1
        if (networkErrorCountRef.current >= MAX_NETWORK_RETRIES) {
          stopPolling()
          setError(`Cannot reach backend at ${API_BASE}. Is the server running?`)
          setIsAnalyzing(false)
        }
      }
    },
    [router, stopPolling]
  )

  useEffect(() => {
    if (!jobId) return
    // Record when polling starts (for the SF2 timeout) and reset the error counter.
    // Ref assignments don't trigger the react-hooks/set-state-in-effect rule.
    pollStartRef.current = Date.now()
    networkErrorCountRef.current = 0
    // Defer the immediate poll one tick to avoid calling setState synchronously
    // inside the effect body (which triggers the react-hooks/set-state-in-effect rule).
    const t = setTimeout(() => pollJob(jobId), 0)
    pollingRef.current = setInterval(() => pollJob(jobId), 2000)
    return () => { clearTimeout(t); stopPolling() }
  }, [jobId, pollJob, stopPolling])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) return

    if (!GITHUB_REPO_RE.test(trimmed)) {
      setError("Please enter a valid public GitHub repository URL (e.g. https://github.com/owner/repo)")
      return
    }

    setError(null)
    setIsAnalyzing(true)
    setShowProgress(true)
    setSteps(STEPS.map((s) => ({ ...s, status: "pending" })))

    try {
      const res = await apiFetch(`${API_BASE}/api/repos/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: trimmed, user_id: "demo" }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? body.message ?? `Error ${res.status}`)
      }
      const data: IngestResponse = await res.json()
      // Capture repo_id immediately — don't wait for the poll to surface it
      repoIdRef.current = data.repo_id
      // Persist the GitHub URL so the Q&A page can display the real repo name
      try { localStorage.setItem(`codebase:repo:${data.repo_id}`, trimmed) } catch { /* ignore */ }
      setJobId(data.job_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start analysis.")
      setIsAnalyzing(false)
      setSteps(STEPS)
    }
  }

  const completedCount = steps.filter((s) => s.status === "complete").length
  const progressPct = showProgress ? Math.round((completedCount / steps.length) * 100) : 0

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="dot-grid absolute inset-0 opacity-40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-indigo-600/8 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-indigo-800/6 blur-[100px]" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-white" />
          </div>
          <span className="font-mono text-sm font-semibold text-zinc-100 tracking-tight cursor-blink">
            CodeBase
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/pricing"
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors rounded-md hover:bg-zinc-800/60"
          >
            Pricing
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="p-2 text-zinc-500 hover:text-zinc-200 transition-colors rounded-md hover:bg-zinc-800/60"
          >
            <GitBranch className="w-4 h-4" />
          </a>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl flex flex-col items-center text-center gap-8">
          {/* Badge */}
          <div className="animate-slide-up inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono">
            <Zap className="w-3 h-3" />
            AI-powered codebase intelligence
          </div>

          {/* Heading */}
          <div className="animate-slide-up [animation-delay:80ms] flex flex-col gap-3">
            <h1 className="font-display text-5xl sm:text-6xl font-bold text-zinc-50 leading-[1.05] tracking-tight">
              Understand any codebase
              <br />
              <span className="text-shimmer">in 60 seconds</span>
            </h1>
            <p className="text-zinc-400 text-lg font-light max-w-lg mx-auto leading-relaxed">
              Drop a GitHub URL. Get instant answers, architecture overviews, and
              deep code understanding — powered by AI.
            </p>
          </div>

          {/* Input form */}
          <form
            onSubmit={handleSubmit}
            className="animate-slide-up [animation-delay:160ms] w-full"
          >
            <div
              className={cn(
                "flex items-center gap-0 rounded-xl border bg-zinc-900/80 backdrop-blur-sm transition-all duration-300",
                error
                  ? "border-red-500/50"
                  : isAnalyzing
                  ? "border-indigo-500/50 glow-indigo"
                  : "border-zinc-700/60 hover:border-zinc-600/80 focus-within:border-indigo-500/60 focus-within:glow-indigo-sm"
              )}
            >
              <div className="flex items-center gap-2 px-4 text-zinc-500">
                <GitBranch className="w-4 h-4 shrink-0" />
              </div>
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(null) }}
                placeholder="https://github.com/owner/repository"
                disabled={isAnalyzing}
                className="flex-1 bg-transparent py-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none font-mono disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isAnalyzing || !url.trim()}
                className={cn(
                  "flex items-center gap-2 m-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
                  isAnalyzing || !url.trim()
                    ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-[0.97]"
                )}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing
                  </>
                ) : (
                  <>
                    Analyze
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 text-red-400 text-sm animate-slide-up">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </form>

          {/* Progress panel */}
          {showProgress && (
            <div className="animate-slide-up w-full rounded-xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm overflow-hidden">
              {/* Progress bar */}
              <div className="h-0.5 bg-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-700 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                    Analysis Pipeline
                  </span>
                  <span className="text-xs font-mono text-zinc-500">
                    {completedCount}/{steps.length} steps
                  </span>
                </div>

                <ol className="space-y-1">
                  {steps.map((step, i) => (
                    <li
                      key={step.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300",
                        step.status === "active" && "bg-indigo-500/8 border border-indigo-500/15",
                        step.status === "complete" && "opacity-60",
                        step.status === "pending" && "opacity-40"
                      )}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <StepIcon status={step.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-medium font-mono",
                              step.status === "complete" && "text-zinc-400",
                              step.status === "active" && "text-indigo-300",
                              step.status === "pending" && "text-zinc-600",
                              step.status === "failed" && "text-red-400"
                            )}
                          >
                            {step.label}
                          </span>
                          {step.status === "active" && (
                            <span className="text-xs text-zinc-500">{step.detail}</span>
                          )}
                        </div>
                      </div>
                      {step.status === "active" && (
                        <div className="flex gap-0.5">
                          {[0, 1, 2].map((j) => (
                            <span
                              key={j}
                              className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse"
                              style={{ animationDelay: `${j * 200}ms` }}
                            />
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {/* Trust signals */}
          {!showProgress && (
            <div className="animate-slide-up [animation-delay:240ms] flex items-center gap-6 text-xs text-zinc-600">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Source code never retained
              </span>
              <span className="w-px h-3 bg-zinc-800" />
              <span className="flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Results in ~60s
              </span>
              <span className="w-px h-3 bg-zinc-800" />
              <span className="flex items-center gap-1.5">
                <Globe className="w-3 h-3" /> Any public repo
              </span>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
