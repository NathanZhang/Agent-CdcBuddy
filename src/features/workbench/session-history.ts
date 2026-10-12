export interface ChatSessionItem {
 sessionId:string;userId:string;userName:string;userRole:string;title:string;messageCount:number;isPinned:boolean;
 lastGenerativeViewType?:string|null;createdAt:string;updatedAt:string;
}
function historyDate(value:string):Date{
 // SQLite's unqualified timestamps are written in UTC by the business provider.
 return new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)?value.replace(' ','T')+'Z':value);
}
export function formatHistoryTime(value:string):string{
 const date=historyDate(value);if(!Number.isFinite(date.getTime()))return '时间未知';
 const two=(n:number)=>String(n).padStart(2,'0');
 return `${two(date.getMonth()+1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
export function groupHistorySessions(sessions:ChatSessionItem[],now=new Date()){
 const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-6);
 const groups=[{label:'已置顶',sessions:[] as ChatSessionItem[]},{label:'近 7 天',sessions:[] as ChatSessionItem[]},{label:'更早记录',sessions:[] as ChatSessionItem[]}];
 const time=(session:ChatSessionItem)=>historyDate(session.updatedAt||session.createdAt).getTime()||0;
 for(const session of [...sessions].sort((a,b)=>time(b)-time(a))){
  groups[session.isPinned?0:time(session)>=start.getTime()?1:2].sessions.push(session);
 }
 return groups.filter(group=>group.sessions.length);
}
const resultLabels:Record<string,string>={
 DATA_TABLE_VIEW:'数据表',AGUI_RESULT_GROUP:'组合分析',ANALYTICS_RESULT:'研判分析',
 POPULATION_DENSITY_TREND:'趋势分析',SPECIES_COMPOSITION:'物种构成',SPATIAL_EARLY_WARNING_MAP:'空间地图',
 TRANSMISSION_RISK_GAUGE:'传播风险',PATHOGEN_RISK_ANALYSIS:'病原分析',RESISTANCE_EVALUATION:'抗药性分析',
 RESISTANCE_EVOLUTION_CHART:'抗药性演变',AUTO_GENERATED_REPORT:'研判报告',
 DENSITY_GBDT_FORECAST:'趋势预测',COLLECTION_RESULT:'采集结果',ARTIFACT_DOWNLOAD:'导出文件',
};
export function historyResultLabel(type?:string|null):string{return type?resultLabels[type]??'研判结果':'对话记录';}
interface HistoryListState {sessions:ChatSessionItem[];total:number;keyword:string;loading:boolean;error:string;hasMore:boolean;}
/** Latest request wins; clearing/closing invalidates reads that are already in flight. */
export function createSessionHistoryList(read:(keyword:string,offset:number)=>Promise<{sessions:ChatSessionItem[];total:number}>){
 const initial=():HistoryListState=>({sessions:[],total:0,keyword:'',loading:false,error:'',hasMore:false});
 let state=initial(),revision=0,nextOffset=0;const listeners=new Set<()=>void>();
 const update=(changes:Partial<HistoryListState>)=>{state={...state,...changes};listeners.forEach(listener=>listener());};
 const load=async(keyword='',append=false)=>{
  keyword=keyword.trim();
  if(append&&(state.loading||!state.hasMore||keyword!==state.keyword))return;
  const current=++revision,offset=append?nextOffset:0;
  update({loading:true,error:'',...(!append?{keyword,...(keyword!==state.keyword?{sessions:[],total:0,hasMore:false}:{})}:{})});
  try{
   const result=await read(keyword,offset);if(current!==revision)return;
   const sessions=append?Array.from(new Map([...state.sessions,...result.sessions].map(session=>[session.sessionId,session])).values()):result.sessions;
   nextOffset=offset+result.sessions.length;
   update({sessions,total:result.total,hasMore:result.sessions.length>0&&nextOffset<result.total});
  }catch(error){if(current===revision)update({error:error instanceof Error?error.message:'读取历史会话失败'});}
  finally{if(current===revision)update({loading:false});}
 };
 return {getState:()=>state,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},load,
  reset:()=>{revision++;nextOffset=0;state=initial();listeners.forEach(listener=>listener());},
  invalidate:()=>{revision++;update({loading:false});}
 };
}
