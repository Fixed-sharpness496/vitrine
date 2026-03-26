"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { getAnalytics, type AnalyticsData } from "@/lib/api";

const ACCENT = "#C9A96E";
const MUTED = "#767672";
const BORDER = "#E8E7E3";
const BG_SUBTLE = "#EEEDE9";
const TEXT = "#0A0A0A";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function SectionTitle({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="label-caps" style={{ color: MUTED }}>{label}</p>
      <h2 className="display heading-tight mt-0.5" style={{ fontSize: "clamp(18px, 2.5vw, 26px)" }}>{title}</h2>
    </div>
  );
}

/* ── 1. Indicateurs clés ─────────────────────────────────────────── */
function KpiCards({ q }: { q: AnalyticsData["quality"] }) {
  const cards = [
    { label: "Articles au catalogue", value: q.total_records?.toLocaleString("fr-FR") ?? "-" },
    { label: "Données complètes", value: q.valid_records?.toLocaleString("fr-FR") ?? "-" },
    { label: "Complétude", value: q.completeness_pct != null ? `${q.completeness_pct.toFixed(1)}%` : "-" },
    { label: "Prix moyen", value: q.price_mean != null ? fmt(q.price_mean) : "-" },
    { label: "Fourchette de prix", value: q.price_min != null ? `${fmt(q.price_min)} – ${fmt(q.price_max)}` : "-" },
  ];
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
      {cards.map(({ label, value }) => (
        <div key={label} style={{ padding: "16px 20px", background: "var(--bg-surface)", border: `1px solid ${BORDER}`, borderRadius: 8 }}>
          <p className="label-caps" style={{ color: MUTED, marginBottom: 6 }}>{label}</p>
          <p className="mono tabnum" style={{ fontSize: 20, color: TEXT }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

/* ── 2. Top familles par taille ──────────────────────────────────── */
function FamillesBars({ data }: { data: AnalyticsData["cluster_distribution"] }) {
  const top = data.slice(0, 20);
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={top} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="cluster_label" width={160} tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "var(--bg-surface)", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}
          formatter={(v) => [(v as number).toLocaleString("fr-FR"), "Articles"]}
        />
        <Bar dataKey="product_count" fill={ACCENT} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── 3. Prix moyen par famille ───────────────────────────────────── */
function PrixBars({ data }: { data: AnalyticsData["pricing"] }) {
  const top = data.slice(0, 15);
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={top} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <YAxis type="category" dataKey="cluster_label" width={160} tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "var(--bg-surface)", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}
          formatter={(v) => [fmt(v as number), "Prix moyen"]}
        />
        <Bar dataKey="avg_price" fill={TEXT} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── 4. Volume de commandes ──────────────────────────────────────── */
function Timeline({ data }: { data: AnalyticsData["timeline"] }) {
  const byDate: Record<string, number> = {};
  for (const row of data) {
    byDate[row.sale_date] = (byDate[row.sale_date] ?? 0) + row.sales_count;
  }
  const series = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sales_count]) => ({ date: date.slice(5), sales_count }));

  if (series.length === 0) return (
    <p className="mono" style={{ fontSize: 12, color: MUTED }}>Aucune donnée de vente disponible.</p>
  );

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={series} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} interval={6} />
        <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "var(--bg-surface)", border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12 }}
          formatter={(v) => [(v as number).toLocaleString("fr-FR"), "Commandes"]}
        />
        <Line type="monotone" dataKey="sales_count" stroke={ACCENT} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── 5. Assortiment catégorie × rayon ────────────────────────────── */
function Heatmap({ data }: { data: AnalyticsData["heatmap"] }) {
  const depts = [...new Set(data.map((r) => r.department))].sort();
  const cats = [...new Set(data.map((r) => r.category))].sort();
  const maxCount = Math.max(...data.map((r) => r.product_count), 1);

  const lookup: Record<string, number> = {};
  for (const row of data) lookup[`${row.category}||${row.department}`] = row.product_count;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 10, minWidth: 400 }}>
        <thead>
          <tr>
            <th style={{ padding: "4px 8px", textAlign: "left", color: MUTED, fontWeight: 400 }} />
            {depts.map((d) => (
              <th key={d} style={{ padding: "4px 6px", color: MUTED, fontWeight: 400, whiteSpace: "nowrap", writingMode: "vertical-rl", height: 80 }}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cats.map((cat) => (
            <tr key={cat}>
              <td style={{ padding: "3px 8px", color: MUTED, whiteSpace: "nowrap" }}>{cat}</td>
              {depts.map((dept) => {
                const count = lookup[`${cat}||${dept}`] ?? 0;
                const intensity = count / maxCount;
                const bg = count === 0
                  ? BG_SUBTLE
                  : `rgba(201,169,110,${0.15 + intensity * 0.85})`;
                return (
                  <td
                    key={dept}
                    title={`${cat} × ${dept} : ${count.toLocaleString("fr-FR")} articles`}
                    style={{ width: 28, height: 24, background: bg, border: `1px solid var(--bg)`, borderRadius: 2 }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── 6. Top marques par famille ──────────────────────────────────── */
function MarquesTable({ data }: { data: AnalyticsData["brands"] }) {
  const clusters = [...new Set(data.map((r) => r.cluster_label))].slice(0, 6);
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
      {clusters.map((cluster) => {
        const rows = data.filter((r) => r.cluster_label === cluster).slice(0, 5);
        return (
          <div key={cluster} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
            <p style={{ fontSize: 11, fontWeight: 500, marginBottom: 8, color: TEXT }}>{cluster}</p>
            {rows.map((r) => (
              <div key={r.brand} className="flex justify-between" style={{ paddingBottom: 4 }}>
                <span style={{ fontSize: 11, color: MUTED }}>{r.brand}</span>
                <span className="mono tabnum" style={{ fontSize: 11, color: ACCENT }}>{r.product_count}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics()
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="mb-12">
        <p className="label-caps" style={{ color: MUTED }}>/ analyses</p>
        <h1 className="display heading-tight mt-1" style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>
          Tableau de bord
        </h1>
        <p className="mono mt-1" style={{ fontSize: 12, color: MUTED }}>
          Données actualisées en temps réel
        </p>
      </div>

      {error && (
        <p className="mono mb-8" style={{ fontSize: 12, color: "var(--red)" }}>{error}</p>
      )}

      {loading && (
        <div className="grid gap-8">
          {[280, 320, 240].map((h, i) => (
            <div key={i} style={{ height: h, background: BG_SUBTLE, borderRadius: 8, opacity: 1 - i * 0.2 }} />
          ))}
        </div>
      )}

      {data && (
        <div className="grid gap-16">

          <section>
            <SectionTitle label="Vue d'ensemble" title="Indicateurs clés" />
            <KpiCards q={data.quality} />
          </section>

          <section>
            <SectionTitle label="Familles produits" title="Top 20 par nombre d'articles" />
            <div style={{ background: "var(--bg-surface)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "24px 8px 16px" }}>
              <FamillesBars data={data.cluster_distribution} />
            </div>
          </section>

          <section>
            <SectionTitle label="Ventes" title="Volume de commandes (180 jours)" />
            <div style={{ background: "var(--bg-surface)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "24px 8px 16px" }}>
              <Timeline data={data.timeline} />
            </div>
          </section>

          <section>
            <SectionTitle label="Prix" title="Prix moyen par famille" />
            <div style={{ background: "var(--bg-surface)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "24px 8px 16px" }}>
              <PrixBars data={data.pricing} />
            </div>
          </section>

          <section>
            <SectionTitle label="Assortiment" title="Catégorie × Rayon" />
            <div style={{ background: "var(--bg-surface)", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 24 }}>
              <Heatmap data={data.heatmap} />
            </div>
          </section>

          <section>
            <SectionTitle label="Marques" title="Top marques par famille" />
            <MarquesTable data={data.brands} />
          </section>

        </div>
      )}
    </div>
  );
}
