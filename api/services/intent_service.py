"""Buyer intent analysis via RAG on product embeddings."""
from __future__ import annotations

import json
from collections import defaultdict

from google.cloud import bigquery
from openai import OpenAI

from config import OPENAI_API_KEY, EMBEDDING_MODEL, GPT_MODEL
from config import TABLE_EMBEDDED, TABLE_CLEAN, TABLE_CLUSTERED, TABLE_ENRICHED
from models.schemas import IntentRequest, IntentResponse, ClusterBrief, IntentProduct

_SEARCH_POOL = 120  # how many products to pull from VECTOR_SEARCH


def _embed(text: str) -> list[float]:
    client = OpenAI(api_key=OPENAI_API_KEY)
    resp = client.embeddings.create(model=EMBEDDING_MODEL, input=text)
    return resp.data[0].embedding


def _generate_brief(client: OpenAI, intent: str, label: str, avg_price: float,
                    products: list[dict]) -> tuple[str, str, str]:
    sample_names = ", ".join(p["name"] for p in products[:5])
    prompt = (
        f"You are a retail merchandising expert.\n"
        f"A buyer described this intent: \"{intent}\"\n\n"
        f"One matching product cluster is: \"{label}\" "
        f"(avg price €{avg_price:.0f}, sample products: {sample_names}).\n\n"
        f"In 3 short fields (1-2 sentences each), respond with JSON:\n"
        f'{{"positioning": "...", "price_range": "...", "buyer_action": "..."}}\n'
        f"positioning: what this cluster represents for the buyer.\n"
        f"price_range: exact range as '€X–€Y'.\n"
        f"buyer_action: one concrete recommendation for Q-next assortment."
    )
    resp = client.chat.completions.create(
        model=GPT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
        temperature=0.3,
        response_format={"type": "json_object"},
    )
    raw = json.loads(resp.choices[0].message.content)
    return (
        raw.get("positioning", ""),
        raw.get("price_range", ""),
        raw.get("buyer_action", ""),
    )


def analyze_intent(bq: bigquery.Client, req: IntentRequest) -> IntentResponse:
    vector = _embed(req.intent)
    vector_json = json.dumps(vector)

    # Step 1: VECTOR_SEARCH → top products with cluster info
    sql = f"""
    SELECT
      base.product_id,
      c.name,
      c.brand,
      c.retail_price,
      cl.cluster_id,
      cl.cluster_label,
      vs.distance
    FROM
      VECTOR_SEARCH(
        TABLE `{TABLE_EMBEDDED}`,
        'embedding',
        (SELECT {vector_json} AS embedding),
        top_k => {_SEARCH_POOL},
        distance_type => 'COSINE'
      ) vs
    JOIN `{TABLE_CLEAN}`      c  ON vs.base.product_id = c.product_id
    JOIN `{TABLE_CLUSTERED}`  cl ON c.product_id = cl.product_id
    WHERE cl.cluster_id != -1
    ORDER BY vs.distance ASC
    """
    rows = list(bq.query(sql).result())

    # Step 2: Aggregate by cluster
    cluster_hits: dict[int, list] = defaultdict(list)
    for r in rows:
        cluster_hits[int(r.cluster_id)].append({
            "product_id": r.product_id,
            "name": r.name,
            "brand": r.brand,
            "retail_price": float(r.retail_price),
            "cluster_label": r.cluster_label,
            "distance": float(r.distance),
        })

    # Sort clusters by hit count desc, take top N
    sorted_clusters = sorted(cluster_hits.items(), key=lambda x: len(x[1]), reverse=True)
    top_clusters = sorted_clusters[: req.top_k_clusters]

    if not top_clusters:
        return IntentResponse(intent=req.intent, clusters=[])

    # Step 3: For each top cluster fetch total product count + avg price
    cluster_ids = [str(cid) for cid, _ in top_clusters]
    ids_str = ", ".join(cluster_ids)
    stats_sql = f"""
    SELECT
      cl.cluster_id,
      cl.cluster_label,
      COUNT(*) AS products_total,
      AVG(c.retail_price) AS avg_price
    FROM `{TABLE_CLUSTERED}` cl
    JOIN `{TABLE_CLEAN}` c ON cl.product_id = c.product_id
    WHERE cl.cluster_id IN ({ids_str})
    GROUP BY cl.cluster_id, cl.cluster_label
    """
    stats_rows = {int(r.cluster_id): r for r in bq.query(stats_sql).result()}

    # Step 4: Generate GPT brief for each cluster
    oai = OpenAI(api_key=OPENAI_API_KEY)
    result_clusters: list[ClusterBrief] = []

    for cluster_id, hits in top_clusters:
        stat = stats_rows.get(cluster_id)
        if not stat:
            continue

        label = stat.cluster_label or f"Cluster {cluster_id}"
        avg_price = float(stat.avg_price)
        products_total = int(stat.products_total)
        sample = hits[:5]

        positioning, price_range, buyer_action = _generate_brief(
            oai, req.intent, label, avg_price, sample
        )

        result_clusters.append(ClusterBrief(
            cluster_id=cluster_id,
            cluster_label=label,
            hit_count=len(hits),
            products_total=products_total,
            avg_price=round(avg_price, 2),
            sample_products=[
                IntentProduct(
                    product_id=p["product_id"],
                    name=p["name"],
                    brand=p["brand"],
                    retail_price=p["retail_price"],
                )
                for p in sample
            ],
            positioning=positioning,
            price_range=price_range,
            buyer_action=buyer_action,
        ))

    return IntentResponse(intent=req.intent, clusters=result_clusters)
