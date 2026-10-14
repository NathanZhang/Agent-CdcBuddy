import Ajv from 'ajv';
import {EFFORT_UNITS,type ArtifactRef} from './scientific-artifact';
import type {ScienceOperation} from '@/application/science/operations';
export type ScienceNodeStatus='PENDING'|'RUNNING'|'RETRY_WAIT'|'SUCCEEDED'|'SKIPPED'|'FAILED'|'CANCELLED';
export interface ScienceNode {id:string;operation:ScienceOperation|'lstm';inputs:Record<string,string>;params:Record<string,any>;window?:{from:string;to:string};when?:{node:string;test:'has-members'|'empty'|'finite';};retry?:{maxAttempts:number;delayMs:number};}
export interface SciencePlan {version:'1';scope:{from:string;to:string;city?:string;district?:string;category?:string;methodName:string;speciesName?:string};nodes:ScienceNode[];}
export interface CompiledSciencePlan extends SciencePlan {nodes:(ScienceNode&{window:{from:string;to:string};retry:{maxAttempts:number;delayMs:number}})[];}
export interface ScienceCheckpoint {nodeId:string;status:ScienceNodeStatus;attempts:number;output:ArtifactRef|null;error:string|null;}
const text={type:'string',minLength:1,maxLength:200},date={type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'};
const window={type:'object',additionalProperties:false,required:['from','to'],properties:{from:date,to:date}};
export const sciencePlanSchema={type:'object',additionalProperties:false,required:['version','scope','nodes'],properties:{version:{const:'1'},scope:{type:'object',additionalProperties:false,required:['from','to','methodName'],properties:{from:date,to:date,city:text,district:text,category:{enum:['蚊','蝇','蟑螂','鼠','蜱','恙螨']},methodName:text,speciesName:text}},nodes:{type:'array',minItems:1,maxItems:32,items:{type:'object',additionalProperties:false,required:['id','operation','inputs','params'],properties:{id:{type:'string',pattern:'^[a-zA-Z][a-zA-Z0-9_-]{0,63}$'},operation:{enum:['measurements','scan','scan-select','features','kmeans','cluster-select','series','lstm']},inputs:{type:'object',maxProperties:4,additionalProperties:{type:'string',minLength:1,maxLength:64}},params:{type:'object'},window,when:{type:'object',additionalProperties:false,required:['node','test'],properties:{node:text,test:{enum:['has-members','empty','finite']}}},retry:{type:'object',additionalProperties:false,required:['maxAttempts','delayMs'],properties:{maxAttempts:{type:'integer',minimum:1,maximum:5},delayMs:{type:'integer',minimum:0,maximum:60000}}}}}}}};
const metric={metric:{enum:['capture-count','capture-per-record','capture-per-effort']},effortUnit:{enum:EFFORT_UNITS}};
export const scienceParameterSchemas:Record<ScienceOperation,any>={
 measurements:{type:'object',additionalProperties:false,properties:{maxRecords:{type:'integer',minimum:1,maximum:50000}}},
 scan:{type:'object',additionalProperties:false,properties:{exposure:{enum:['record','effort']},effortUnit:{enum:EFFORT_UNITS},seed:{type:'integer',minimum:0,maximum:2147483647},simulations:{type:'integer',minimum:19,maximum:999},pThreshold:{type:'number',exclusiveMinimum:0,maximum:.1},maxRadiusKm:{type:'number',exclusiveMinimum:0,maximum:500}}},
 'scan-select':{type:'object',additionalProperties:false,properties:{clusterIds:{type:'array',uniqueItems:true,maxItems:500,items:text}}},
 features:{type:'object',additionalProperties:false,required:['metric'],properties:{...metric,features:{type:'array',minItems:1,maxItems:3,uniqueItems:true,items:{enum:['metric','record-count','visit-count']}}}},
 kmeans:{type:'object',additionalProperties:false,properties:{k:{type:'integer',minimum:2,maximum:20},seed:{type:'integer',minimum:0,maximum:2147483647}}},
 'cluster-select':{type:'object',additionalProperties:false,properties:{labels:{type:'array',uniqueItems:true,maxItems:20,items:{type:'integer',minimum:0,maximum:19}}}},
 series:{type:'object',additionalProperties:false,required:['metric','frequency'],properties:{...metric,frequency:{enum:['day','week','month']}}}
};
const ajv=new Ajv({strict:false,strictNumbers:true});const check=ajv.compile(sciencePlanSchema);
export function assertSciencePlan(value:unknown):asserts value is SciencePlan{if(!check(value))throw Error('DAG_SCHEMA_INVALID: '+ajv.errorsText(check.errors));}
export function validateScienceParameters(op:ScienceOperation,params:Record<string,any>){const check=ajv.compile(scienceParameterSchemas[op]);if(!check(params))throw Error('DAG_PARAMETERS_INVALID: '+ajv.errorsText(check.errors));if((params.metric==='capture-per-effort'||params.exposure==='effort')&&!params.effortUnit)throw Error('MEASUREMENT_UNIT_REQUIRED');if(params.effortUnit&&op==='scan'&&(params.exposure??'record')!=='effort')throw Error('DAG_EXPOSURE_UNIT_CONFLICT');if(params.effortUnit&&['features','series'].includes(op)&&params.metric!=='capture-per-effort')throw Error('DAG_METRIC_UNIT_CONFLICT');}
