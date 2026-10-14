import {nextPeriod,type MeasurementRecord,type Measurements,type SelectionSet,type FeatureMatrix,type SeriesSet,type ScientificArtifact,type EffortUnit} from '@/contracts/scientific-artifact';
export type MeasurementMetric='capture-count'|'capture-per-record'|'capture-per-effort';
export function metricUnit(metric:MeasurementMetric,effortUnit?:EffortUnit):string{if(metric==='capture-count')return 'capture';if(metric==='capture-per-record')return 'capture/record';if(!effortUnit)throw Error('MEASUREMENT_UNIT_REQUIRED');return `capture/${effortUnit}`;}
export function measurementDefinition(metric:MeasurementMetric,effortUnit?:EffortUnit):string{return `${metric}${effortUnit?':'+effortUnit:''}-v1`;}
export function buildSelection(source:ScientificArtifact<'Measurements'>,requested?:string[]):SelectionSet {
 if(!source.data.complete)throw Error('ARTIFACT_INCOMPLETE');const available=new Set(source.data.records.map(r=>r.locationKey));const keys=requested??[...available];
 if(new Set(keys).size!==keys.length||keys.some(k=>!available.has(k)))throw Error('SELECTION_MEMBERSHIP_INVALID');return {locationKeys:[...keys].sort()};
}
function selectedRows(measurements:Measurements,selection:SelectionSet):MeasurementRecord[]{if(!measurements.complete)throw Error('ARTIFACT_INCOMPLETE');const available=new Set(measurements.records.map(r=>r.locationKey));if(selection.locationKeys.some(k=>!available.has(k)))throw Error('SELECTION_MEMBERSHIP_INVALID');return measurements.records.filter(r=>selection.locationKeys.includes(r.locationKey));}
export function aggregateMeasurement(rows:MeasurementRecord[],metric:MeasurementMetric,effortUnit?:EffortUnit){
 metricUnit(metric,effortUnit);
 const valid=rows.every(r=>r.captureCount!==null);const captureCount=rows.length&&valid?rows.reduce((sum,r)=>sum+r.captureCount!,0):null;
 const allVisits=rows.length>0&&rows.every(r=>r.visitId&&r.effortValue!==null&&r.effortUnit);
 const visits=new Map<string,MeasurementRecord>();for(const r of rows)if(r.visitId){const old=visits.get(r.visitId);if(old&&[old.locationKey,old.methodId,old.date,old.effortValue,old.effortUnit].join('|')!==[r.locationKey,r.methodId,r.date,r.effortValue,r.effortUnit].join('|'))throw Error('MEASUREMENT_VISIT_CONFLICT');visits.set(r.visitId,r);}
 if(metric==='capture-per-effort'&&rows.some(r=>r.effortUnit!==null&&r.effortUnit!==effortUnit))throw Error('MEASUREMENT_UNIT_MISMATCH');
 const units=new Set([...visits.values()].map(r=>r.effortUnit));const resolvedUnit=allVisits&&units.size===1?[...units][0]:null;
 const effort=resolvedUnit?[...visits.values()].reduce((sum,r)=>sum+r.effortValue!,0):null;
 const value=captureCount===null?null:metric==='capture-count'?captureCount:metric==='capture-per-record'?captureCount/rows.length:effort!==null&&effort>0?captureCount/effort:null;
 return {value,captureCount,recordCount:rows.length,visitCount:allVisits?visits.size:null,effort,effortUnit:resolvedUnit};
}
export function buildFeatureMatrix(measurements:Measurements,selection:SelectionSet,metric:MeasurementMetric,effortUnit?:EffortUnit,features:('metric'|'record-count'|'visit-count')[]=['metric','record-count']):FeatureMatrix {
 const rows=selectedRows(measurements,selection);if(new Set(rows.map(r=>r.methodId)).size>1)throw Error('MEASUREMENT_METHOD_REQUIRED');
 if(!features.length||new Set(features).size!==features.length||features.some(f=>!['metric','record-count','visit-count'].includes(f)))throw Error('FEATURE_COLUMNS_INVALID');
 const columns=features.map(f=>f==='metric'?{key:metric,unit:metricUnit(metric,effortUnit)}:f==='record-count'?{key:f,unit:'record'}:{key:f,unit:'visit'});
 return {rowKeys:selection.locationKeys,columns,values:selection.locationKeys.map(key=>{const r=aggregateMeasurement(rows.filter(r=>r.locationKey===key),metric,effortUnit);return features.map(f=>f==='metric'?r.value:f==='record-count'?r.recordCount:r.visitCount);})};
}
export function periodStart(date:string,frequency:'day'|'week'|'month'):string{if(frequency==='day')return date;if(frequency==='month')return date.slice(0,7)+'-01';const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
export function buildSeriesSet(measurements:Measurements,selection:SelectionSet,metric:MeasurementMetric,frequency:'day'|'week'|'month',window:{from:string;to:string},effortUnit?:EffortUnit):SeriesSet {
 const rows=selectedRows(measurements,selection);const calendar:string[]=[];for(let p=periodStart(window.from,frequency);p<=window.to;p=nextPeriod(p,frequency)){if(calendar.length>=3650)throw Error('SERIES_PERIOD_LIMIT');calendar.push(p);}
 const groups=new Map<string,MeasurementRecord[]>();for(const r of rows){const key=[r.locationKey,encodeURIComponent(r.methodId),encodeURIComponent(r.speciesId)].join(':');const group=groups.get(key)??[];group.push(r);groups.set(key,group);}
 if(groups.size*calendar.length>100000)throw Error('SERIES_CELL_LIMIT');
 return {series:[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([objectKey,group])=>({objectKey,locationKey:group[0].locationKey,methodId:group[0].methodId,speciesId:group[0].speciesId,points:calendar.map(period=>({period,...aggregateMeasurement(group.filter(r=>periodStart(r.date,frequency)===period),metric,effortUnit)}))}))};
}
