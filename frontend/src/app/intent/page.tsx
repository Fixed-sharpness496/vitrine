"use client";

import { useState, useTransition, useCallback } from "react";
import { analyzeIntent, type ClusterBrief } from "@/lib/api";

const EXAMPLES = [
  "outdoor sports gear for men under $60",
  "premium women's casual fashion",
  "kids clothing essentials, affordable basics",
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function ClusterCard({ brief, index }: { brief: ClusterBrief; index: number }) {
  return (
    <div
      className="row-enter"
      style={{
        animationDelay: `${index * 80}ms`,
        borderTop: "1px solid var(--border)",
        paddingTop: 24,
        paddingBottom: 24,
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="label-caps" style={{ color: "var(--text-muted)" }}>
            Cluster {brief.cluster_id}
          </p>
          <h2
            className="display heading-tight mt-0.5"
            style={{ fontSize: "clamp(18px, 2.5vw, 24px)" }}
          >
            {brief.cluster_label}
          </h2>
        </div>

        <div className="flex gap-6">
          <div className="text-right">
            <p className="label-caps" style={{ color: "var(--text-faint)" }}>
              Avg price
            </p>
            <p className="mono tabnum" style={{ fontSize: 15, color: "var(--accent)" }}>
              {fmt(brief.avg_price)}
            </p>
          </div>
          <div className="text-right">
            <p className="label-caps" style={{ color: "var(--text-faint)" }}>
              Match
            </p>
            <p className="mono tabnum" style={{ fontSize: 15 }}>
              {brief.hit_count}
              <span style={{ color: "var(--text-faint)", fontSize: 11 }}>
                {" "}/ {brief.products_total}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Brief */}
      <div
        className="mt-4 grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
      >
        <BriefBlock label="Positioning" value={brief.positioning} />
        <BriefBlock label="Price range" value={brief.price_range} accent />
        <BriefBlock label="Buyer action" value={brief.buyer_action} />
      </div>

      {/* Sample products */}
      {brief.sample_products.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {brief.sample_products.map((p) => (
            <span
              key={p.product_id}
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "2px 8px",
              }}
            >
              {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BriefBlock({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
        borderRadius: 6,
      }}
    >
      <p className="label-caps" style={{ color: "var(--text-faint)", marginBottom: 4 }}>
        {label}
      </p>
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: accent ? "var(--accent)" : "var(--text)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ marginTop: 8 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 24,
            paddingBottom: 24,
            opacity: 1 - i * 0.25,
          }}
        >
          <div
            style={{
              height: 14,
              width: "40%",
              background: "var(--bg-subtle)",
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
          <div
            style={{
              height: 22,
              width: "60%",
              background: "var(--bg-subtle)",
              borderRadius: 4,
            }}
          />
          <div
            className="mt-4 grid gap-4"
            style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
          >
            {[0, 1, 2].map((j) => (
              <div
                key={j}
                style={{
                  height: 72,
                  background: "var(--bg-subtle)",
                  borderRadius: 6,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function IntentPage() {
  const [intent, setIntent] = useState("");
  const [result, setResult] = useState<ClusterBrief[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = useCallback((q: string) => {
    if (!q.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const data = await analyzeIntent(q.trim());
        setResult(data.clusters);
      } catch (e) {
        setError((e as Error).message);
        setResult(null);
      }
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6">
      {/* Hero */}
      <div className="py-16 md:py-20">
        <p className="label-caps" style={{ color: "var(--text-muted)" }}>
          / intent
        </p>
        <h1
          className="display heading-tight mt-1"
          style={{ fontSize: "clamp(32px, 4.5vw, 50px)", lineHeight: 1.1 }}
        >
          Buyer Intent Analysis
        </h1>
        <p className="mono mt-2" style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Describe a buying intent → surface matching clusters + AI buyer brief
        </p>

        <div className="search-wrap mt-8 max-w-2xl">
          <input
            type="text"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run(intent)}
            placeholder="outdoor sports gear for men under $60…"
            autoComplete="off"
            spellCheck={false}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 15,
              color: "var(--text)",
              paddingBottom: 6,
            }}
          />
          <div className="search-line" />
        </div>

        <div className="mt-3 flex items-center gap-4 flex-wrap">
          <p className="label-caps" style={{ color: "var(--text-faint)" }}>
            {isPending ? "Analyzing…" : "Press Enter or try:"}
          </p>
          {!isPending &&
            EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setIntent(ex);
                  run(ex);
                }}
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "3px 10px",
                  cursor: "pointer",
                  transition: "border-color 120ms",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.borderColor =
                    "var(--border-strong)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.borderColor =
                    "var(--border)")
                }
              >
                {ex}
              </button>
            ))}
        </div>
      </div>

      {error && (
        <p className="mb-6 mono" style={{ fontSize: 12, color: "var(--red)" }}>
          {error}
        </p>
      )}

      {isPending && <Skeleton />}

      {!isPending && result !== null && (
        <section className="mb-16">
          {result.length === 0 ? (
            <p
              className="py-12 mono text-center"
              style={{ fontSize: 12, color: "var(--text-muted)" }}
            >
              No clusters matched this intent.
            </p>
          ) : (
            result.map((brief, i) => (
              <ClusterCard key={brief.cluster_id} brief={brief} index={i} />
            ))
          )}
        </section>
      )}

      {!isPending && result === null && (
        <div className="py-20" style={{ borderTop: "1px solid var(--border)" }} />
      )}
    </div>
  );
}
