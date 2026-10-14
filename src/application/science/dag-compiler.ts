import type {ExecutionContext} from '@/contracts/execution-context';
import {assertSciencePlan,validateScienceParameters,type CompiledSciencePlan,type SciencePlan} from '@/contracts/scientific-dag';
import {validDate} from '@/contracts/scientific-artifact';
import {assertPrincipal} from '@/infrastructure/auth/authorization';
import {loadDatasetManifest} from '@/infrastructure/db/dataset-manifest';
import {scopeFromArgs} from '@/domains/shared/skill-factory';
import {operationInputs,operationOutputs,type ScienceOperation} from './operations';
export function compileSciencePlan(input:SciencePlan,ctx:ExecutionContext):CompiledSciencePlan{
 assertPrincipal(ctx);if(ctx.domain!=='vector'||ctx.principal.role==='PUBLIC_VIEWER')throw Error('FORBIDDEN_SCIENCE_DAG');assertSciencePlan(input);
 scopeFromArgs(input.scope,ctx);const root=ctx.approvedIntent!.effectiveDataScope.time;if(!root)throw Error('DAG_ROOT_WINDOW_REQUIRED');if(root.to>loadDatasetManifest().find(d=>d.domain===ctx.domain)!.asOf)throw Error('DAG_CUTOFF_UNAVAILABLE');
 const nodes=new Map(input.nodes.map(n=>[n.id,n]));if(nodes.size!==input.nodes.length)throw Error('DAG_DUPLICATE_NODE');
 const visiting=new Set<string>(),visited=new Set<string>(),ordered:string[]=[];
 const visit=(id:string,depth=0)=>{if(depth>16)throw Error('DAG_DEPTH_LIMIT');if(visiting.has(id))throw Error('DAG_CYCLE');if(visited.has(id))return;const n=nodes.get(id);if(!n)throw Error('DAG_UNKNOWN_DEPENDENCY');visiting.add(id);for(const dep of [...Object.values(n.inputs),...(n.when?[n.when.node]:[])])visit(dep,depth+1);visiting.delete(id);visited.add(id);ordered.push(id);};
 input.nodes.forEach(n=>visit(n.id));const compiled=new Map<string,CompiledSciencePlan['nodes'][number]>();const measurementSource=new Map<string,string>();
 for(const id of ordered){
  const node=structuredClone(nodes.get(id)!);if(node.operation==='lstm')throw Error('CAPABILITY_UNAVAILABLE: LSTM requires trained weights and accepted observed rolling backtest; no validated model is registered');
  const op=node.operation as ScienceOperation;validateScienceParameters(op,node.params);
  if(Object.keys(node.inputs).sort().join(',')!==Object.keys(operationInputs[op]).sort().join(','))throw Error('DAG_INPUT_PORTS_INVALID');
  for(const [port,sourceId] of Object.entries(node.inputs))if(operationOutputs[compiled.get(sourceId)!.operation as ScienceOperation]!==operationInputs[op][port])throw Error('DAG_ARTIFACT_TYPE_MISMATCH');
  const primary=Object.values(node.inputs)[0],defaultWindow=primary?compiled.get(primary)!.window:root;
  const window=node.window??defaultWindow;
  if(!validDate(window.from)||!validDate(window.to)||window.from>window.to||window.from<root.from||window.to>root.to)throw Error('DAG_TIME_WIDENING');
  for(const [port,sourceId] of Object.entries(node.inputs)){
   const source=compiled.get(sourceId)!;if(port==='selection'&&(op==='series'||op==='features')){if(source.window.to>window.to)throw Error('DAG_MEMBERSHIP_LOOKAHEAD');continue;}
   if(window.from<source.window.from||window.to>source.window.to)throw Error('DAG_TIME_WIDENING');
   if(['scan-select','cluster-select','kmeans'].includes(op)&&(window.from!==source.window.from||window.to!==source.window.to))throw Error('DAG_MEMBERSHIP_WINDOW_INVALID');
  }
  if(op==='measurements')measurementSource.set(id,id);
  else {const ancestor=measurementSource.get(node.inputs.measurements??primary);if(ancestor)measurementSource.set(id,ancestor);}
  if(['features','series'].includes(op)&&measurementSource.get(node.inputs.measurements)!==measurementSource.get(node.inputs.selection))throw Error('DAG_SELECTION_SOURCE_MISMATCH');
  if(node.when){const output=operationOutputs[compiled.get(node.when.node)!.operation as ScienceOperation];if(node.when.test==='finite'&&!['FeatureMatrix','SeriesSet'].includes(output)||node.when.test!=='finite'&&!['ScanResult','SelectionSet','ClusterSet'].includes(output))throw Error('DAG_CONDITION_TYPE_INVALID');}
  compiled.set(id,{...node,window,retry:node.retry??{maxAttempts:3,delayMs:1000}});
 }
 return {version:'1',scope:structuredClone(input.scope),nodes:[...compiled.values()]};
}
