"""POST /intent — buyer intent analysis via GenAI RAG."""
from fastapi import APIRouter, Depends
from google.cloud import bigquery

from models.schemas import IntentRequest, IntentResponse
from services.bq_client import get_bq_client
from services import intent_service

router = APIRouter(prefix="/intent", tags=["intent"])


@router.post("", response_model=IntentResponse)
def analyze_intent(
    body: IntentRequest,
    bq: bigquery.Client = Depends(get_bq_client),
) -> IntentResponse:
    return intent_service.analyze_intent(bq, body)
