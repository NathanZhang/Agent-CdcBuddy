import {assertResultSources} from '@/infrastructure/db/dataset-policy';
import type {ExecutionContext} from '@/contracts/execution-context';
import {authorizeScope} from '@/infrastructure/auth/authorization';
import {readAuthorizedQuerySource} from '@/application/geo/query-source-store';
import {readAuthorizedSpatialOutput} from '@/application/geo/spatial-store';
/** Session snapshots are cached outputs, never a new grant of data access. */
export function authorizeHistoryView(value:any,ctx:ExecutionContext):any{
 if(!value)return null;const view=typeof value==='string'?JSON.parse(value):value;
 if(view.type==='AGUI_RESULT_GROUP')return {...view,views:view.views.map((v:any)=>authorizeHistoryView(v,ctx))};
 if(view.type==='MAP_VIEW')return view;
 if(view.type==='MAP_COMPOSITION'){for(const layer of view.layers)readAuthorizedSpatialOutput(layer.request.outputRef,ctx);return view;}
 assertResultSources(view.datasets,ctx.deploymentTier);
 if(view.type==='DATA_TABLE_VIEW'&&view.runId&&view.callId){readAuthorizedQuerySource(view.runId,view.callId,ctx);return view;}
 if(view.type==='DATA_TABLE_VIEW'&&(ctx.principal.role==='PUBLIC_VIEWER'||ctx.principal.jurisdiction.city&&view.scope?.city!==ctx.principal.jurisdiction.city||ctx.principal.jurisdiction.district&&view.scope?.district!==ctx.principal.jurisdiction.district))throw Error('FORBIDDEN_UNVERIFIED_HISTORY');
 if(view.scope)authorizeScope(view.scope,ctx);
 return view;
}
export function publicHistoryBase(value:any):any{if(!value)return null;const view=typeof value==='string'?JSON.parse(value):value;if(view.type==='MAP_VIEW')return view;if(view.type==='MAP_COMPOSITION')return {...view,layers:[],legendGroups:[],lineage:[],layerOutcomes:[],status:'FAILED'};if(view.type==='AGUI_RESULT_GROUP'){const views=view.views.map(publicHistoryBase).filter(Boolean);return views.length?{...view,views,status:'FAILED'}:null;}return null;}
