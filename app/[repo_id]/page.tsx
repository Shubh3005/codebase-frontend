"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Send,
  Terminal,
  Bot,
  User,
  Loader2,
  ExternalLink,
  AlertCircle,
  MessageSquare,
  Home,
  FileCode2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001"

type Citation = {
  file_path: string
  line_start: number
  line_end: number
  symbol_name?: string
  github_url?: string
}

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
}

type QueryResponse = {
  answer: string
  citations?: Citation[]
  session_id?: string
}

const SUGGESTED_QUESTIONS = [
  "What is the entry point of this application?",
  "What are the main modules or components?",
  "How does the data flow through this codebase?",
  "What dependencies does this project use?",
]

function CitationPill({ citation }: { citation: Citation }) {
  const label = citation.file_path.split("/").pop() ?? citation.file_path
  const lineInfo =
    citation.line_start != null
      ? citation.line_end != null && citation.line_end !== citation.line_start
        ? `L${citation.line_start}–${citation.line_end}`
        : `L${citation.line_start}`
      : null

  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono",
        "bg-indigo-500/10 border border-indigo-500/20 text-indigo-300",
        "transition-all duration-150",
        citation.github_url
          ? "hover:bg-indigo-500/20 hover:border-indigo-400/40 cursor-pointer"
          : "cursor-default"
      )}
    >
      <FileCode2 className="w-3 h-3 shrink-0" />
      {label}
      {lineInfo && <span className="text-indigo-400/70">{lineInfo}</span>}
      {citation.github_url && <ExternalLink className="w-2.5 h-2.5 opacity-60" />}
    </span>
  )

  if (citation.github_url) {
    return (
      <a href={citation.github_url} target="_blank" rel="noreferrer">
        {content}
      </a>
    )
  }
  return content
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"

  return (
    <div
      className={cn(
        "flex gap-3 animate-slide-up",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
          isUser ? "bg-indigo-600" : "bg-zinc-800 border border-zinc-700"
        )}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-white" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-indigo-400" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[78%] flex flex-col gap-2",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed",
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : "bg-zinc-800/80 border border-zinc-700/50 text-zinc-100 rounded-tl-sm"
          )}
        >
          {message.content}
        </div>

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {message.citations.map((c, i) => (
              <CitationPill key={`${c.file_path}:${c.line_start}:${i}`} citation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RepoChatPage() {
  const params = useParams()
  const repoId = params.repo_id as string

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Recover the GitHub URL stored by the ingest page via localStorage — read after
  // mount to avoid an SSR/client hydration mismatch.
  const [githubUrl, setGithubUrl] = useState<string | null>(null)
  useEffect(() => {
    // Defer one tick so setState runs in a callback, not the effect body directly
    // (matches the project's react-hooks/set-state-in-effect convention).
    const t = setTimeout(() => {
      try { setGithubUrl(localStorage.getItem(`codebase:repo:${repoId}`)) } catch {}
    }, 0)
    return () => clearTimeout(t)
  }, [repoId])
  // Starts null — omitted from the first request so the backend creates a fresh session.
  // The returned session_id is then stored here and sent on every subsequent request.
  const sessionIdRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Derive a human-readable label: "owner/repo" from the GitHub URL or fallback UUID prefix
  const repoName = githubUrl
    ? githubUrl.replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "")
    : repoId.length > 12 ? `${repoId.slice(0, 8)}…` : repoId

  const sendMessage = useCallback(
    async (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || isLoading) return

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      }

      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setIsLoading(true)
      setError(null)

      try {
        // Only include session_id once the backend has issued one
        const body: Record<string, string> = { question: trimmed }
        if (sessionIdRef.current) body.session_id = sessionIdRef.current

        const res = await fetch(`${API_BASE}/api/repos/${repoId}/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          throw new Error(errBody.detail ?? errBody.message ?? `Error ${res.status}`)
        }

        const data: QueryResponse = await res.json()

        // Persist the session_id for all subsequent requests in this page session
        if (data.session_id) sessionIdRef.current = data.session_id

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          citations: data.citations,
        }

        setMessages((prev) => [...prev, assistantMsg])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get a response.")
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
        setInput(trimmed)
      } finally {
        setIsLoading(false)
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    },
    [isLoading, repoId]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }

  return (
    <div className="h-screen flex bg-[#0a0a0a] overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-72 shrink-0 flex flex-col border-r border-zinc-800/60 bg-zinc-950/60">
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-zinc-800/60">
          <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-white" />
          </div>
          <span className="font-mono text-sm font-semibold text-zinc-100 cursor-blink">
            CodeBase
          </span>
        </div>

        {/* Repo info */}
        <div className="px-4 py-3 border-b border-zinc-800/40">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-400 shrink-0 animate-pulse" />
            <span className="text-xs text-zinc-500 font-mono uppercase tracking-wide">
              Active Repo
            </span>
          </div>
          {githubUrl ? (
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 group"
            >
              <p className="text-sm text-zinc-200 font-mono font-medium truncate group-hover:text-indigo-300 transition-colors">
                {repoName}
              </p>
              <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-indigo-400 shrink-0 transition-colors" />
            </a>
          ) : (
            <p className="text-sm text-zinc-200 font-mono font-medium truncate">
              {repoName}
            </p>
          )}
        </div>

        {/* File explorer */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <div className="flex items-center gap-2 px-2 mb-2">
            <FileCode2 className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
              Files
            </span>
          </div>
          <p className="px-2 text-xs text-zinc-700 font-mono leading-relaxed">
            File explorer coming soon — use citations in answers to jump to source.
          </p>
        </div>

        {/* Back link */}
        <div className="px-3 py-3 border-t border-zinc-800/60">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors font-mono"
          >
            <Home className="w-3.5 h-3.5" />
            Analyze another repo
          </Link>
        </div>
      </aside>

      {/* ── Chat panel ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-800/60 bg-zinc-950/40">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-zinc-200">
              Ask anything about{" "}
              <span className="font-mono text-indigo-300">{repoName}</span>
            </span>
          </div>
          <span className="text-xs font-mono text-zinc-600">
            {repoId.slice(0, 8)}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center gap-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                <Bot className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-display font-semibold text-zinc-200 mb-1">
                  Ready to answer your questions
                </h2>
                <p className="text-sm text-zinc-500 max-w-sm">
                  Ask anything about this codebase — architecture, functions,
                  dependencies, or how to get started.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-sm">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="px-4 py-2.5 rounded-xl text-sm text-left text-zinc-400 bg-zinc-900/60 border border-zinc-800/60 hover:border-indigo-500/30 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all duration-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex gap-3 animate-slide-up">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-zinc-800 border border-zinc-700">
                    <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-zinc-800/80 border border-zinc-700/50">
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"
                          style={{ animationDelay: `${i * 200}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-2 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-slide-up">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Input */}
        <div className="px-6 pb-6 pt-2">
          <form
            onSubmit={handleSubmit}
            className={cn(
              "flex items-end gap-3 p-3 rounded-2xl border bg-zinc-900/80 backdrop-blur-sm transition-all duration-200",
              "border-zinc-700/60 focus-within:border-indigo-500/50 focus-within:glow-indigo-sm"
            )}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this codebase… (Enter to send, Shift+Enter for newline)"
              disabled={isLoading}
              rows={1}
              className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none resize-none leading-relaxed disabled:opacity-50 min-h-[24px]"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
                isLoading || !input.trim()
                  ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-95"
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
          <p className="mt-2 text-center text-xs text-zinc-700">
            AI responses may contain inaccuracies. Always verify critical information.
          </p>
        </div>
      </div>
    </div>
  )
}
