"""Data quality report service."""
from __future__ import annotations

from google.cloud import bigquery
from config import TABLE_QUALITY
from models.schemas import QualityReport
from services.cache import ttl_cache


@ttl_cache(seconds=600)
def get_quality_report(bq: bigquery.Client) -> QualityReport:
    sql = f"""
    SELECT *
    FROM `{TABLE_QUALITY}`
    ORDER BY report_timestamp DESC
    LIMIT 1
    """
    rows = list(bq.query(sql).result())
    if not rows:
        raise ValueError("No quality report found — run the pipeline first.")

    r = rows[0]
    return QualityReport(
        report_timestamp=r.report_timestamp.isoformat(),
        total_records=r.total_records,
        valid_records=r.valid_records,
        completeness_pct=float(r.completeness_pct),
        field_name_completeness=r.field_name_completeness,
        field_brand_completeness=r.field_brand_completeness,
        field_cat_completeness=r.field_cat_completeness,
        field_price_completeness=r.field_price_completeness,
        price_mean=float(r.price_mean) if r.price_mean is not None else None,
        price_min=float(r.price_min) if r.price_min is not None else None,
        price_max=float(r.price_max) if r.price_max is not None else None,
    )
