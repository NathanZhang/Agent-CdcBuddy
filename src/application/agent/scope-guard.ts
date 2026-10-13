import {Parser} from 'node-sql-parser';
import type {ApprovedIntent} from '@/contracts/approved-intent';
import type {DatasetRegionBindings} from '@/infrastructure/geo/dataset-region-bindings';
import {isApprovedIntent} from './intent-guard';
export class ScopeError extends Error{constructor(public code:string,message:string){super(message);}}
export function compileScopedFilters(approved:ApprovedIntent,bindings:DatasetRegionBindings){
 if(!isApprovedIntent(approved))throw new ScopeError('FORBIDDEN_INTENT','未经服务器批准的范围');
 const bind=(code:string)=>{const r=bindings.regions.find(r=>r.code===code);if(!r)throw new ScopeError('REGION_DATASET_MAPPING_REQUIRED',`来源缺少地域映射：${code}`);return {...(r.city?{city:r.city}:{}),...(r.district?{district:r.district}:{})};};
 const regionPaths=approved.effectiveDataScope.region.includeCodes.map(bind),excludePaths=approved.effectiveDataScope.region.excludeCodes.map(bind);return {regionPaths,excludePaths,from:approved.effectiveDataScope.time?.from,to:approved.effectiveDataScope.time?.to,filters:approved.effectiveDataScope.filters,scopeFingerprint:approved.fingerprint};
}
export function assertSkillMatchesIntent(args:Record<string,any>,approved:ApprovedIntent,bindings:DatasetRegionBindings):void{
 const scope=compileScopedFilters(approved,bindings),single=scope.regionPaths.length===1?scope.regionPaths[0]:{};
 for(const field of ['city','district','from','to','asOf'] as const){const expected=field==='city'||field==='district'?single[field]:field==='asOf'?scope.to:scope[field];if(args[field]!==undefined&&args[field]!==expected)throw new ScopeError('SCOPE_MISMATCH',`技能参数 ${field} 与批准范围不一致`);}
 if(args.year!==undefined&&(!scope.from||!scope.to||Number(scope.from.slice(0,4))!==args.year||Number(scope.to.slice(0,4))!==args.year))throw new ScopeError('SCOPE_MISMATCH','技能年份与批准范围不一致');
 if(args.month!==undefined&&(!scope.from||!scope.to||Number(scope.from.slice(5,7))!==args.month||Number(scope.to.slice(5,7))!==args.month))throw new ScopeError('SCOPE_MISMATCH','技能月份与批准范围不一致');
 for(const field of ['category','speciesName','methodName','pathogenName','pesticideName','pathogen','pathogenType','diseaseName','basinName','pathogenId','clusterId'])if(args[field]!==undefined){const f=scope.filters[field];if(!f||f.operator!=='eq'||f.values[0]!==args[field])throw new ScopeError('SCOPE_MISMATCH',`技能筛选 ${field} 未获批准`);}
}
export function assertSqlMatchesIntent(sql:string,approved:ApprovedIntent,bindings:DatasetRegionBindings):void{
 if(approved.draft.queryBinding){const p=new Parser(),normalize=(s:string)=>JSON.stringify(p.astify(s,{database:'SQLite'}));const supplied=p.astify(sql,{database:'SQLite'}) as any;const original=p.astify(approved.draft.queryBinding.sql,{database:'SQLite'}) as any;if(!supplied.limit)delete original.limit;if(normalize(p.sqlify(supplied,{database:'SQLite'}))!==normalize(p.sqlify(original,{database:'SQLite'})))throw new ScopeError('SCOPE_MISMATCH','结构化查询与服务器批准的查询不一致');return;}
 const p=new Parser(),parsed=p.astify(sql,{database:'SQLite'}),ast=(Array.isArray(parsed)?parsed[0]:parsed) as any;const scope=compileScopedFilters(approved,bindings);
 if(ast.having)throw new ScopeError('SCOPE_MISMATCH','额外HAVING筛选未经批准');
 const sensitive=new Set(['city','city_name','district','district_name','province','date_id','visit_date','isolation_date','sample_date','start_time','monitoring_date','date','inspection_date','created_at','death_date','diagnosed_date','injury_time','year','month','day','category','species_name','method_name','pathogen_name','pesticide_name','disease_name','basin_name']);
 const filterColumns:Record<string,string>={category:'category',species_name:'speciesName',method_name:'methodName',pathogen_name:'pathogenName',pesticide_name:'pesticideName',disease_name:'diseaseName',basin_name:'basinName'};
 const allCols=(n:any):string[]=>!n||typeof n!=='object'?[]:n.type==='column_ref'?[typeof n.column==='string'?n.column:n.column?.expr?.value]:Object.values(n).flatMap(v=>Array.isArray(v)?v.flatMap(allCols):allCols(v));
 const visit=(n:any,where=false)=>{if(!n||typeof n!=='object')return;if(n.type==='binary_expr'){
 const operator=String(n.operator).toUpperCase();if(['AND','OR'].includes(operator)){if(operator==='OR'&&allCols(n).some(c=>sensitive.has(c)))throw new ScopeError('SCOPE_MISMATCH','不能以OR扩大或改写批准筛选');visit(n.left,where);visit(n.right,where);return;}
 const columns=allCols(n),usesScope=columns.some(c=>sensitive.has(c));
 if(where||usesScope){let equivalent=false;const col=n.left?.type==='column_ref'?n.left.column:null,value=n.right?.value;
 if(where&&operator==='='&&['city','city_name','district','district_name'].includes(col)){const key=col.startsWith('city')?'city':'district';equivalent=scope.regionPaths.length===1&&scope.regionPaths[0][key]===value&&!scope.excludePaths.length;}
 if(where&&operator==='='&&filterColumns[col]){const f=scope.filters[filterColumns[col]];equivalent=f?.operator==='eq'&&f.values[0]===value;}
 if(!equivalent)throw new ScopeError('SCOPE_MISMATCH','SQL存在未批准或不同口径的地域、时间或业务筛选');
 }
 }
 for(const [key,v] of Object.entries(n)){if(Array.isArray(v))v.forEach(item=>visit(item,where||key==='where'));else if(key!=='from')visit(v,where||key==='where');}};
 visit(ast);
}
