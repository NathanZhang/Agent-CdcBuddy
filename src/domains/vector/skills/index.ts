import { buildDomainSkills,scopeFromArgs } from '../../shared/skill-factory';
import { getDomainRepository } from '@/infrastructure/db/domain-repository';
import type { SkillExecution } from '@/contracts/skill-definition';
import type { ExecutionContext } from '@/contracts/execution-context';
async function speciesComposition(args:Record<string,any>,ctx:ExecutionContext):Promise<SkillExecution>{
  const params:unknown[]=[args.category ?? '蚊'];
  let where='s.category=?';
  if(args.year!==undefined){where+=' AND substr(f.date_id,1,4)=?';params.push(String(args.year));}
  const rows=getDomainRepository('vector').query(`SELECT s.species_name,s.latin_name,s.category,SUM(f.capture_count) AS totalCount FROM fact_monitoring f JOIN dim_species s ON f.species_id=s.species_id WHERE ${where} GROUP BY s.species_name,s.latin_name,s.category ORDER BY totalCount DESC`,params,scopeFromArgs(args,ctx));
  if(!rows.length)return {status:'NO_DATA',payload:null};
  const total=rows.reduce((sum,row)=>sum+Number(row.totalCount),0);
  if(total===0)return {status:'INSUFFICIENT_DATA',payload:{type:'SPECIES_COMPOSITION',items:[],dominantSpecies:null,shannonWienerIndex:null,clusters:[]},qualityFlags:['zero-capture-denominator']};
  const items=rows.map(row=>({speciesName:row.species_name,latinName:row.latin_name,category:row.category,totalCount:Number(row.totalCount),percentage:Math.round(Number(row.totalCount)/total*10000)/100,cityBreakdown:[]}));
  const h=rows.reduce((sum,row)=>{const p=Number(row.totalCount)/total;return p>0?sum-p*Math.log(p):sum;},0);
  return {status:'SUCCESS',payload:{type:'SPECIES_COMPOSITION',city:args.city ?? '河南省全域',category:args.category ?? '蚊',items,dominantSpecies:items[0].speciesName,shannonWienerIndex:Math.round(h*1000)/1000,clusters:[]},qualityFlags:['composition-only-no-cluster-inference']};
}
export function vectorSkills(){return buildDomainSkills('vector',{skill_species_composition:{availability:'available',name:'物种捕获构成与多样性汇总',description:'按实际捕获数计算物种构成比与Shannon指数；不输出未执行的聚类结论。',method:'observed-species-composition-v1',inputSchema:{type:'object',additionalProperties:false,properties:{category:{enum:['蚊','蝇','蟑螂','鼠','蜱','恙螨']},city:{type:'string'},district:{type:'string'},year:{type:'integer',minimum:1900,maximum:2100}}},outputSchema:{type:'object',required:['type','items','dominantSpecies','shannonWienerIndex'],properties:{type:{const:'SPECIES_COMPOSITION'},items:{type:'array'},dominantSpecies:{type:['string','null']},shannonWienerIndex:{type:['number','null']}}},allowedOperations:['read'],execute:speciesComposition}});}
