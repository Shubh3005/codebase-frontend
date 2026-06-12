import Link from "next/link"
import { Check, Minus, Terminal, Zap, Users, Building2, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

type Tier = {
  id: string
  name: string
  price: string
  period: string
  tagline: string
  icon: React.ComponentType<{ className?: string }>
  cta: string
  ctaHref: string
  featured: boolean
  features: string[]
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "/month",
    tagline: "Perfect for exploring open-source repos",
    icon: Zap,
    cta: "Get started free",
    ctaHref: "/",
    featured: false,
    features: [
      "3 repositories",
      "50 queries per day",
      "7-day query history",
      "Public repos only",
      "1 team member",
      "Community support",
    ],
  },
  {
    id: "team",
    name: "Team",
    price: "$49",
    period: "/month",
    tagline: "For dev teams that need more power",
    icon: Users,
    cta: "Start free trial",
    ctaHref: "/",
    featured: true,
    features: [
      "Unlimited repositories",
      "1,000 queries per day",
      "30-day query history",
      "Private repos",
      "Up to 10 team members",
      "Priority support",
      "Shared workspaces",
      "API access",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$199",
    period: "/month",
    tagline: "Mission-critical deployments at scale",
    icon: Building2,
    cta: "Contact sales",
    ctaHref: "mailto:sales@codebase.ai",
    featured: false,
    features: [
      "Unlimited repositories",
      "Unlimited queries",
      "Unlimited history",
      "Private repos & self-hosted",
      "Unlimited team members",
      "Dedicated support",
      "Custom integrations",
      "SSO / SAML",
      "SLA guarantee",
      "Audit logs",
    ],
  },
]

type FeatureRow = {
  label: string
  free: string | boolean
  team: string | boolean
  enterprise: string | boolean
}

const COMPARISON: FeatureRow[] = [
  { label: "Repositories",        free: "3",         team: "Unlimited",  enterprise: "Unlimited" },
  { label: "Queries per day",     free: "50",        team: "1,000",      enterprise: "Unlimited" },
  { label: "Query history",       free: "7 days",    team: "30 days",    enterprise: "Unlimited" },
  { label: "Team members",        free: "1",         team: "10",         enterprise: "Unlimited" },
  { label: "Private repos",       free: false,       team: true,         enterprise: true },
  { label: "API access",          free: false,       team: true,         enterprise: true },
  { label: "Priority support",    free: false,       team: true,         enterprise: true },
  { label: "Custom integrations", free: false,       team: false,        enterprise: true },
  { label: "SSO / SAML",          free: false,       team: false,        enterprise: true },
  { label: "Audit logs",          free: false,       team: false,        enterprise: true },
  { label: "SLA guarantee",       free: false,       team: false,        enterprise: true },
  { label: "Dedicated support",   free: false,       team: false,        enterprise: true },
]

function CellValue({ value, featured }: { value: string | boolean; featured: boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className={cn("w-4 h-4 mx-auto", featured ? "text-indigo-400" : "text-zinc-400")} />
    ) : (
      <Minus className="w-4 h-4 mx-auto text-zinc-700" />
    )
  }
  return (
    <span className={cn("text-sm font-mono", featured ? "text-indigo-300" : "text-zinc-400")}>
      {value}
    </span>
  )
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="dot-grid absolute inset-0 opacity-30" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full bg-indigo-700/6 blur-[120px]" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-white" />
          </div>
          <span className="font-mono text-sm font-semibold text-zinc-100 cursor-blink">
            CodeBase
          </span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono mb-5">
            Simple, transparent pricing
          </div>
          <h1 className="font-display text-5xl font-bold text-zinc-50 tracking-tight mb-4">
            Choose your plan
          </h1>
          <p className="text-zinc-400 text-lg max-w-md mx-auto leading-relaxed">
            Start free. Scale when you need it. No hidden fees.
          </p>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-20">
          {TIERS.map((tier) => {
            const Icon = tier.icon
            return (
              <div
                key={tier.id}
                className={cn(
                  "relative rounded-2xl border p-7 flex flex-col gap-6 transition-all duration-300",
                  tier.featured
                    ? "bg-indigo-600/5 border-indigo-500/40 glow-indigo"
                    : "bg-zinc-900/40 border-zinc-800/60 hover:border-zinc-700/80"
                )}
              >
                {tier.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-semibold font-mono whitespace-nowrap">
                    Most popular
                  </div>
                )}

                {/* Tier header */}
                <div className="flex flex-col gap-3">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center",
                      tier.featured ? "bg-indigo-600/20 text-indigo-400" : "bg-zinc-800 text-zinc-400"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-bold text-zinc-100">{tier.name}</h2>
                    <p className="text-sm text-zinc-500 mt-0.5">{tier.tagline}</p>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-display font-bold text-zinc-50">{tier.price}</span>
                    <span className="text-sm text-zinc-500">{tier.period}</span>
                  </div>
                </div>

                {/* CTA */}
                <a
                  href={tier.ctaHref}
                  className={cn(
                    "block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                    tier.featured
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60"
                  )}
                >
                  {tier.cta}
                </a>

                {/* Feature list */}
                <ul className="space-y-2.5 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-400">
                      <Check
                        className={cn(
                          "w-4 h-4 shrink-0",
                          tier.featured ? "text-indigo-400" : "text-zinc-600"
                        )}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Comparison table */}
        <div>
          <h2 className="font-display text-2xl font-bold text-zinc-100 text-center mb-8">
            Full feature comparison
          </h2>
          <div className="rounded-2xl border border-zinc-800/60 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800/60 bg-zinc-900/60">
                  <th className="text-left px-6 py-4 text-xs font-mono text-zinc-500 uppercase tracking-widest w-2/5">
                    Feature
                  </th>
                  {TIERS.map((t) => (
                    <th
                      key={t.id}
                      className={cn(
                        "px-4 py-4 text-sm font-display font-bold text-center",
                        t.featured ? "text-indigo-300" : "text-zinc-300"
                      )}
                    >
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr
                    key={row.label}
                    className={cn(
                      "border-b border-zinc-800/40 transition-colors",
                      i % 2 === 0 ? "bg-transparent" : "bg-zinc-900/20",
                      "hover:bg-zinc-800/20"
                    )}
                  >
                    <td className="px-6 py-3.5 text-sm text-zinc-400">{row.label}</td>
                    <td className="px-4 py-3.5 text-center">
                      <CellValue value={row.free} featured={false} />
                    </td>
                    <td className="px-4 py-3.5 text-center bg-indigo-500/3">
                      <CellValue value={row.team} featured={true} />
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <CellValue value={row.enterprise} featured={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-20 text-center">
          <p className="text-zinc-500 text-sm mb-4">
            Need a custom plan for a large organization?
          </p>
          <a
            href="mailto:sales@codebase.ai"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-sm text-zinc-200 font-medium transition-all duration-200"
          >
            Talk to sales
          </a>
        </div>
      </main>
    </div>
  )
}
