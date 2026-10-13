import type {ResultStatus} from '@/contracts/skill-result';
export interface OutputOutcome {requestedOutput:string;status:ResultStatus;callId?:string;error?:{code:string;message:string};}
export function aggregateOutputStatus(outcomes:OutputOutcome[]):ResultStatus{for(const s of ['FAILED','CANCELLED','REVIEW_REQUIRED','INSUFFICIENT_DATA','NO_DATA'] as const)if(outcomes.some(o=>o.status===s))return s;return outcomes.length?'SUCCESS':'INSUFFICIENT_DATA';}
