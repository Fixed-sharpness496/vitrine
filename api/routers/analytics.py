"""GET /analytics — all dashboard data in one call."""
from fastapi import APIRouter, Depends
from google.cloud import bigquery

from services.bq_client import get_bq_client
from services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("")
def get_analytics(bq: bigquery.Client = Depends(get_bq_client)) -> dict:
    return analytics_service.get_analytics(bq)
