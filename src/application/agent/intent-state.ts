import type {ExecutionContext} from '@/contracts/execution-context';
import type {IntentState,PendingIntent} from '@/contracts/interaction-intent';
import {isLegacyRecognitionFailure} from '@/contracts/interaction-intent';
import type {ApprovedIntent} from '@/contracts/approved-intent';
import type {MapSceneState} from '@/contracts/map-composition';
import type {OutputOutcome} from './output-outcomes';
import {withBusinessDb} from '@/infrastructure/db/business-store';
import {isApprovedIntent} from './intent-guard';
const keys=(id:string,ctx:ExecutionContext)=>[id,ctx.principal.userId,ctx.principal.organizationId,ctx.domain];
export function readIntentState(sessionId:string,ctx:ExecutionContext):IntentState|null{return withBusinessDb(db=>{const row=db.prepare('SELECT state_json FROM biz_session_intents WHERE session_id=? AND user_id=? AND organization_id=? AND domain=?').get(...keys(sessionId,ctx)) as any;return row?JSON.parse(row.state_json):null;});}
export function readMapScene(sessionId:string,ctx:ExecutionContext):MapSceneState|null{return withBusinessDb(db=>{const row=db.prepare('SELECT scene_json FROM biz_map_scenes WHERE session_id=? AND user_id=? AND organization_id=? AND domain=?').get(...keys(sessionId,ctx)) as any;return row?JSON.parse(row.scene_json):null;});}
export function commitIntentState(sessionId:string,expectedRevision:number,approved:ApprovedIntent,outcomes:OutputOutcome[],ctx:ExecutionContext,scene?:MapSceneState):IntentState{
 if(!isApprovedIntent(approved)||approved.owner.userId!==ctx.principal.userId||approved.owner.organizationId!==ctx.principal.organizationId||approved.domain!==ctx.domain)throw Error('FORBIDDEN_INTENT');
 return withBusinessDb(db=>db.transaction(()=>{const key=keys(sessionId,ctx);const row=db.prepare('SELECT revision,state_json FROM biz_session_intents WHERE session_id=? AND user_id=? AND organization_id=? AND domain=?').get(...key) as any;if((row?.revision??0)!==expectedRevision)throw Error('INTENT_REVISION_CONFLICT');
 if(outcomes.some(o=>['FAILED','CANCELLED','REVIEW_REQUIRED'].includes(o.status)))return row?JSON.parse(row.state_json):{revision:0,contextRef:'none',draft:approved.draft,updatedAt:Date.now()};
 const revision=expectedRevision+1,state:IntentState={revision,contextRef:`${sessionId}:${revision}`,draft:approved.draft,updatedAt:Date.now()};
 db.prepare('INSERT INTO biz_session_intents VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(session_id,user_id,organization_id,domain) DO UPDATE SET revision=excluded.revision,state_json=excluded.state_json,pending_json=NULL').run(...key,revision,JSON.stringify(state));
 if(scene)db.prepare('INSERT INTO biz_map_scenes VALUES(?,?,?,?,?,?) ON CONFLICT(session_id,user_id,organization_id,domain) DO UPDATE SET revision=excluded.revision,scene_json=excluded.scene_json').run(...key,scene.revision,JSON.stringify(scene));return state;}).immediate());
}
export function savePendingIntent(pending:PendingIntent,ctx:ExecutionContext):void{withBusinessDb(db=>{const state=readIntentState(pending.sessionId,ctx);db.prepare('INSERT INTO biz_session_intents VALUES(?,?,?,?,?,?,?) ON CONFLICT(session_id,user_id,organization_id,domain) DO UPDATE SET pending_json=excluded.pending_json').run(...keys(pending.sessionId,ctx),state?.revision??0,JSON.stringify(state??null),JSON.stringify(pending));});}
export function loadPendingIntent(sessionId:string,ctx:ExecutionContext):PendingIntent|null{return withBusinessDb(db=>{const row=db.prepare('SELECT pending_json FROM biz_session_intents WHERE session_id=? AND user_id=? AND organization_id=? AND domain=?').get(...keys(sessionId,ctx)) as any;const pending=row?.pending_json?JSON.parse(row.pending_json):null;return pending&&!isLegacyRecognitionFailure(pending)&&pending.expiresAt>Date.now()?pending:null;});}
