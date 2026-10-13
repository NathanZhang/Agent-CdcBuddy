import {readFileSync} from 'node:fs';
import raw from '../../../config/dataset-region-bindings.json';
import type {AgentDomain} from '@/contracts/dataset';
export interface DatasetRegionBindings {datasetVersion:string;mappingVersion:string;sourceCRS:'EPSG:4326'|'EPSG:4490';coordinateEvidence:string;regions:{code:string;city?:string;district?:string}[];}
export function loadDatasetRegionBindings(domain:AgentDomain,datasetVersion:string):DatasetRegionBindings{const configured=process.env.DATASET_REGION_BINDINGS_PATH?JSON.parse(readFileSync(process.env.DATASET_REGION_BINDINGS_PATH,'utf8')):raw;const value=(configured[domain]?.datasetVersion===datasetVersion?configured[domain]:raw[domain]) as DatasetRegionBindings;if(!value||value.datasetVersion!==datasetVersion)throw Error('REGION_DATASET_MAPPING_REQUIRED');return structuredClone(value);}
