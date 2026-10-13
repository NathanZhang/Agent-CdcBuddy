import {validateReadQuery} from '@/infrastructure/query/query-gateway';
import {getDomainRepository} from '@/infrastructure/db/domain-repository';
import {restrictColumns} from '@/infrastructure/auth/authorization';
import type {ExecutionContext} from '@/contracts/execution-context';
import {approveIntent} from './intent-guard';
import {loadRegionCatalog,searchRegionCandidates} from '@/infrastructure/geo/region-catalog';
/** Structured calls carry explicit server-validated values, and never inherit conversation scope. */
export function approveStructuredIntent(args:Record<string,any>,ctx:ExecutionContext,task:'analysis'|'other'='analysis'){
 const catalog=loadRegionCatalog();let code:string|undefined;
 const resolve=(text:string,parent?:string)=>{const cs=searchRegionCandidates(text,parent).candidates;if(cs.length!==1)throw Error('REGION_UNRESOLVED');return cs[0];};
 if(args.city)code=resolve(args.city).code;
 if(args.district){const parent=code&&catalog.regions.find(r=>r.code===code)?.level==='city'?code:ctx.principal.jurisdiction.city?resolve(ctx.principal.jurisdiction.city).code:undefined;code=resolve(args.district,parent).code;}
 const region=code?{includeCodes:[code],excludeCodes:[],catalogVersion:catalog.version}:null;
 const from=args.from??(Number.isInteger(args.year)?`${args.year}-${String(args.month??1).padStart(2,'0')}-01`:args.asOf?'0001-01-01':null);
 const to=args.to??args.asOf??(Number.isInteger(args.year)?args.month?new Date(Date.UTC(args.year,args.month,0)).toISOString().slice(0,10):`${args.year}-12-31`:null);
 const filters:Record<string,any>={};for(const field of ['category','speciesName','methodName','pathogenName','pesticideName','pathogen','pathogenType','diseaseName','basinName','pathogenId','clusterId'])if(args[field]!==undefined&&args[field]!==null)filters[field]={field,operator:'eq',values:[args[field]]};
 const sql=args.sql??args.sqlQuery;const queryBinding=sql?{sql:validateReadQuery(sql,restrictColumns(getDomainRepository(ctx.domain).getSchema(),ctx.principal))}:undefined;
 return approveIntent({... (queryBinding?{queryBinding}:{}),task,relation:'new',displayRegion:null,dataRegion:region,time:from&&to?{from,to}:null,filters,layerRequests:[],mapOperations:[],mapOptions:{basemap:'vec'}},ctx);
}
