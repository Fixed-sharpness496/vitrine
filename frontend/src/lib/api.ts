const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

/* ── /search ─────────────────────────────────────────────────────── */

export interface SearchResult {
  product_id: number;
  name: string;
  brand: string;
  category: string;
  department: string;
  retail_price: number;
  cluster_label: string | null;
  description_enriched: string | null;
  distance: number;
}

export async function search(
  query: string,
  top_k = 20
): Promise<SearchResult[]> {
  const data = await request<{ query: string; results: SearchResult[] }>(
    "/search",
    { method: "POST", body: JSON.stringify({ query, top_k }) }
  );
  return data.results;
}

/* ── /clusters ───────────────────────────────────────────────────── */

export interface Cluster {
  cluster_id: number;
  cluster_label: string;
  product_count: number;
  avg_price: number;
}

export async function getClusters(): Promise<Cluster[]> {
  const data = await request<{ clusters: Cluster[] }>("/clusters");
  return data.clusters;
}

/* ── /clusters/{id}/products ─────────────────────────────────────── */

export interface ClusterProduct {
  product_id: number;
  name: string;
  brand: string;
  retail_price: number;
  description_enriched: string | null;
}

export async function getClusterProducts(
  id: number,
  limit = 50
): Promise<{ cluster_id: number; cluster_label: string; products: ClusterProduct[] }> {
  return request(`/clusters/${id}/products?limit=${limit}`);
}

/* ── /intent ─────────────────────────────────────────────────────── */

export interface IntentProduct {
  product_id: number;
  name: string;
  brand: string;
  retail_price: number;
}

export interface ClusterBrief {
  cluster_id: number;
  cluster_label: string;
  hit_count: number;
  products_total: number;
  avg_price: number;
  sample_products: IntentProduct[];
  positioning: string;
  price_range: string;
  buyer_action: string;
}

export interface IntentResponse {
  intent: string;
  clusters: ClusterBrief[];
}

export async function analyzeIntent(
  intent: string,
  top_k_clusters = 5
): Promise<IntentResponse> {
  return request<IntentResponse>("/intent", {
    method: "POST",
    body: JSON.stringify({ intent, top_k_clusters }),
  });
}

/* ── /quality ────────────────────────────────────────────────────── */

export interface QualityReport {
  report_timestamp: string;
  total_records: number;
  valid_records: number;
  completeness_pct: number;
  field_name_completeness: number | null;
  field_brand_completeness: number | null;
  field_cat_completeness: number | null;
  field_price_completeness: number | null;
  price_mean: number | null;
  price_min: number | null;
  price_max: number | null;
}

export function getQuality(): Promise<QualityReport> {
  return request("/quality");
}
