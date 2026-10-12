from typing import Any, Literal
import math
from pydantic import BaseModel, ConfigDict, Field, model_validator

Domain = Literal['vector','foodborne','env','chronic']
Status = Literal['SUCCESS','NO_DATA','INSUFFICIENT_DATA','FAILED','REVIEW_REQUIRED','CANCELLED']
class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid',allow_inf_nan=False,strict=True)
class DatasetRef(StrictModel):
    id: str = Field(min_length=1)
    domain: Domain
    origin: Literal['observed','mock']
    version: str = Field(min_length=1)
    asOf: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    schemaVersion: str = Field(min_length=1)
class MetricEvidence(StrictModel):
    value: float | None
    evaluationKind: Literal['unvalidated','computed','synthetic','real-backtest']
    datasetIds: list[str]
    definition: str = Field(min_length=1)
    @model_validator(mode='after')
    def check_evidence(self):
        if self.evaluationKind == 'unvalidated' and self.value is not None:
            raise ValueError('Unvalidated metric must be null')
        if len(set(self.datasetIds)) != len(self.datasetIds):
            raise ValueError('Duplicate metric dataset IDs')
        return self
class ResultError(StrictModel):
    code: str = Field(min_length=1)
    message: str = Field(min_length=1)
    retryable: bool

def check_finite(value):
    if isinstance(value,float) and not math.isfinite(value):
        raise ValueError('Nonfinite result number')
    if isinstance(value,dict):
        for item in value.values(): check_finite(item)
    elif isinstance(value,(list,tuple)):
        for item in value: check_finite(item)

class SkillResult(StrictModel):
    schemaVersion: Literal['1']
    runId: str = Field(min_length=1)
    domain: Domain
    status: Status
    method: str = Field(min_length=1)
    datasets: list[DatasetRef]
    payload: Any
    metrics: dict[str,MetricEvidence]
    qualityFlags: list[str]
    error: ResultError | None = None
    @model_validator(mode='after')
    def validate_result(self):
        if self.status in ('NO_DATA','FAILED','CANCELLED') and self.payload is not None:
            raise ValueError(f'{self.status} must have null payload')
        if self.status == 'SUCCESS' and self.payload is None:
            raise ValueError('SUCCESS requires an executed payload')
        if self.status == 'FAILED' and self.error is None:
            raise ValueError('FAILED requires error evidence')
        ids = {dataset.id for dataset in self.datasets}
        if len(ids) != len(self.datasets): raise ValueError('Duplicate result datasets')
        for metric in self.metrics.values():
            if not set(metric.datasetIds).issubset(ids): raise ValueError('Unknown metric dataset')
        if len(set(self.qualityFlags)) != len(self.qualityFlags): raise ValueError('Duplicate quality flags')
        check_finite(self.payload)
        return self
