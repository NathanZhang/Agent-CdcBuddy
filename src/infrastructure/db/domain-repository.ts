import {isApprovedIntent} from '@/application/agent/intent-guard';
import {compileScopedFilters} from '@/application/agent/scope-guard';
import {Parser} from 'node-sql-parser';
import type {ApprovedIntent} from '@/contracts/approved-intent';
import {assertSqlMatchesIntent} from '@/application/agent/scope-guard';
import {loadDatasetRegionBindings} from '@/infrastructure/geo/dataset-region-bindings';
import type {FilterSpec} from '@/contracts/interaction-intent';
import {scopedViewConstraints} from '@/infrastructure/query/scoped-view';
import {authorizeScope,restrictColumns} from '@/infrastructure/auth/authorization';
import type {Principal} from '@/contracts/principal';
import Database from 'better-sqlite3';
import type { AgentDomain } from '@/contracts/dataset';
import { resolveDatasetLocation } from './dataset-manifest';
import {acquireDatasetLease} from './dataset-policy';
import { validateReadQuery, type QuerySchema } from '../query/query-gateway';
export interface QueryScope {
  approvedIntent?:ApprovedIntent;
  regionPaths?:{city?:string;district?:string}[];
  excludePaths?:{city?:string;district?:string}[];
  filters?:Record<string,FilterSpec>;
  scopeFingerprint?:string;
  domain: AgentDomain;
  city?: string;
  district?: string;
  from?: string;
  to?: string;
  maxRows?: number;
  principal?:Principal;
  allowedColumns?: Record<string,string[]>;
}
const domainTables: Record<AgentDomain,readonly string[]> = {
  vector:['dim_date','dim_location','dim_species','dim_method','dim_environment','dim_audit','dim_pathogen','dim_pesticide','fact_monitoring','fact_pathogen_detection','fact_insecticide_resistance'],
  foodborne:['dim_food_category','dim_pathogen_type','dim_hospital','dim_location','fact_foodborne_case','fact_pathogen_molecular','fact_food_sampling','fact_outbreak_event'],
  env:['dim_env_stations','fact_water_monitoring','fact_sewage_monitoring','fact_air_climate_monitoring','fact_river_basin_monitoring','fact_public_venue_inspection','fact_env_alerts'],
  chronic:['dim_districts','fact_death_registry','fact_chronic_cases','fact_injury_surveillance','fact_chronic_alerts']
};
const dateColumns: Record<string,string> = {fact_monitoring:'date_id',fact_pathogen_detection:'date_id',fact_insecticide_resistance:'date_id',fact_foodborne_case:'visit_date',fact_pathogen_molecular:'isolation_date',fact_food_sampling:'sample_date',fact_outbreak_event:'start_time',fact_water_monitoring:'monitoring_date',fact_sewage_monitoring:'monitoring_date',fact_air_climate_monitoring:'date',fact_river_basin_monitoring:'monitoring_date',fact_public_venue_inspection:'inspection_date',fact_env_alerts:'created_at',fact_death_registry:'death_date',fact_chronic_cases:'diagnosed_date',fact_injury_surveillance:'injury_time',fact_chronic_alerts:'created_at'};
function quoteIdentifier(name: string): string { return `"${name.replaceAll('"','""')}"`; }
export class DomainRepository {
  constructor(readonly domain: AgentDomain, private datasetId?: string) {
    if (!Object.hasOwn(domainTables,domain)) throw new Error('Unknown domain');
  }
  getSchema(): QuerySchema {
    const location=resolveDatasetLocation(this.domain,this.datasetId),release=acquireDatasetLease(location);
    let db:Database.Database|undefined;
    try {db=new Database(location.path,{readonly:true,fileMustExist:true});const schema:QuerySchema={};for(const table of domainTables[this.domain]){const columns=db.prepare(`PRAGMA main.table_info(${quoteIdentifier(table)})`).all() as {name:string}[];if(columns.length)schema[table]=columns.map(c=>c.name);}return schema;} finally {db?.close();release();}
  }
  query(select:string,params:unknown[],scope:QueryScope):Record<string,unknown>[]{return this.queryInternal(select,params,scope,true);}
  /** Fixed scientific projection; caller selects record IDs inside a compiled approved scope. */
  readMonitoringRecords(selection:{afterId?:string;recordIds?:string[];limit:number},scope:QueryScope):Record<string,unknown>[] {
    const intent=scope.approvedIntent,p=scope.principal;
    if(this.domain!=='vector'||!p||p.role==='PUBLIC_VIEWER'||!isApprovedIntent(intent)||intent.domain!==this.domain||intent.owner.userId!==p.userId||intent.owner.organizationId!==p.organizationId)throw Error('FORBIDDEN_SCIENTIFIC_QUERY');
    if(!Number.isSafeInteger(selection.limit)||selection.limit<1||selection.limit>1000||selection.recordIds&&(!selection.recordIds.length||selection.recordIds.length>1000||selection.recordIds.some(id=>typeof id!=='string'||!id)))throw Error('SCIENTIFIC_QUERY_BUDGET');
    if(intent.datasetVersion!==resolveDatasetLocation(this.domain,this.datasetId).version)throw Error('SCIENTIFIC_DATASET_VERSION_CHANGED');
    const compiled=compileScopedFilters(intent,loadDatasetRegionBindings(this.domain,intent.datasetVersion));
    const projection='SELECT f.monitoring_id AS recordId,f.date_id AS date,l.location_id AS sourceLocationId,l.city,l.district,l.latitude,l.longitude,m.method_id AS methodId,m.method_name AS methodName,s.species_id AS speciesId,s.species_name AS speciesName,s.category,f.capture_count AS captureCount,f.sampling_unit AS legacySamplingUnit FROM fact_monitoring f JOIN dim_location l ON f.location_id=l.location_id JOIN dim_species s ON f.species_id=s.species_id JOIN dim_method m ON f.method_id=m.method_id';
    const where=selection.recordIds?' WHERE f.monitoring_id IN ('+selection.recordIds.map(()=>'?').join(',')+')':' WHERE f.monitoring_id>?';
    const params=selection.recordIds??[selection.afterId??''];
    return this.queryInternal(projection+where+' ORDER BY f.monitoring_id LIMIT '+selection.limit,params,{...scope,...compiled,maxRows:selection.limit},false);
  }
  private queryInternal(select: string, params: unknown[], scope: QueryScope, checkPredicates:boolean): Record<string,unknown>[] {

    if(scope.principal){authorizeScope(scope,{runId:'repository',domain:this.domain,deploymentTier:process.env.DEPLOYMENT_TIER==='pilot'?'pilot':'local',principal:scope.principal});scope={...scope,city:scope.principal.jurisdiction.city??scope.city,district:scope.principal.jurisdiction.district??scope.district,allowedColumns:restrictColumns(this.getSchema(),scope.principal)};}
    if (scope.domain !== this.domain) throw new Error('Domain scope mismatch');
    for (const key of ['from','to'] as const) if (scope[key] && !/^\d{4}-\d{2}-\d{2}$/.test(scope[key]!)) throw new Error('Invalid time scope');
    if (scope.from && scope.to && scope.from > scope.to) throw new Error('Invalid time scope order');
    if(checkPredicates&&scope.approvedIntent)assertSqlMatchesIntent(select,scope.approvedIntent,loadDatasetRegionBindings(this.domain,scope.approvedIntent.datasetVersion));
    const parsed=new Parser().astify(select,{database:'SQLite'});const selected=new Set(((Array.isArray(parsed)?parsed[0]:parsed) as any).from?.map((f:any)=>f.table));
    const location = resolveDatasetLocation(this.domain,this.datasetId);
    const release=acquireDatasetLease(location);
    let connection:Database.Database|undefined;
    try {
      const db=connection=new Database(location.path,{readonly:true,fileMustExist:true});
      const schema: QuerySchema = {};
      const columns: Record<string,string[]> = {};
      for (const table of domainTables[this.domain]) {
        const info = db.prepare(`PRAGMA main.table_info(${quoteIdentifier(table)})`).all() as {name:string}[];
        if (!info.length) continue;
        columns[table]=info.map(c=>c.name);
        const allowed = scope.allowedColumns ? scope.allowedColumns[table] : columns[table];
        if (!allowed || !allowed.length) continue;
        if (allowed.some(c=>!columns[table].includes(c))) throw new Error('Invalid allowed column');
        schema[table]=allowed;
      }
      const safeSql = validateReadQuery(select,schema,scope.maxRows ?? 200);
      const literal = (value: string): string => (db.prepare('SELECT quote(?) AS value').get(value) as {value:string}).value;
      // Each query sees constrained TEMP views. main.* access is rejected by the AST gate.
      for (const [table,allowed] of Object.entries(schema)) {
        const col = columns[table];
        const constraints: string[] = scopedViewConstraints(table,col,selected.has(table)?scope:{...scope,filters:undefined},literal);
        const cityColumn = col.includes('city') ? 'city' : col.includes('city_name') ? 'city_name' : null;
        const districtColumn = col.includes('district') ? 'district' : col.includes('district_name') ? 'district_name' : null;
        if (scope.city && cityColumn) constraints.push(`${quoteIdentifier(cityColumn)}=${literal(scope.city)}`);
        if (scope.district && districtColumn) constraints.push(`${quoteIdentifier(districtColumn)}=${literal(scope.district)}`);
        if ((scope.city || scope.district) && col.includes('location_id') && table !== 'dim_location' && this.domain === 'vector') {
          const geo = [scope.city ? `city=${literal(scope.city)}` : '',scope.district ? `district=${literal(scope.district)}` : ''].filter(Boolean).join(' AND ');
          constraints.push(`location_id IN (SELECT location_id FROM main.dim_location WHERE ${geo})`);
        } else if ((scope.city || scope.district) && table.startsWith('fact_') && ((!cityColumn && scope.city) || (!districtColumn && scope.district))) {
          throw new Error(`Cannot enforce geographic scope for ${table}`);
        }
        const date = dateColumns[table];
        if (date && col.includes(date)) {
          if (scope.from) constraints.push(`substr(${quoteIdentifier(date)},1,10)>=${literal(scope.from)}`);
          if (scope.to) constraints.push(`substr(${quoteIdentifier(date)},1,10)<=${literal(scope.to)}`);
        }
        const projection = allowed.map(quoteIdentifier).join(',');
        db.exec(`CREATE TEMP VIEW ${quoteIdentifier(table)} AS SELECT ${projection} FROM main.${quoteIdentifier(table)}${constraints.length ? ` WHERE ${constraints.join(' AND ')}` : ''}`);
      }
      return db.prepare(safeSql).all(...params) as Record<string,unknown>[];
    } finally { connection?.close();release(); }
  }
}
export function getDomainRepository(domain: AgentDomain, options?: {datasetId?:string}): DomainRepository { return new DomainRepository(domain,options?.datasetId); }
