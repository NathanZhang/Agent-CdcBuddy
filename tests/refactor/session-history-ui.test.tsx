import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {createSessionHistoryList,groupHistorySessions,formatHistoryTime,historyResultLabel,type ChatSessionItem} from '@/features/workbench/session-history';
import {SessionHistoryContent} from '@/components/layout/SessionHistoryDrawer';
const item=(id:string,updatedAt:string,patch:Partial<ChatSessionItem>={}):ChatSessionItem=>({sessionId:id,userId:'owner',userName:'张主任',userRole:'PROVINCIAL_ADMIN',title:`会话 ${id}`,messageCount:2,isPinned:false,createdAt:updatedAt,updatedAt,...patch});
const recent=item('recent','2026-10-10T01:49:00Z',{title:'全省蚊媒趋势研判',messageCount:16,lastGenerativeViewType:'POPULATION_DENSITY_TREND'});
const older=item('older','2026-09-28T01:27:00Z',{lastGenerativeViewType:'SPATIAL_EARLY_WARNING_MAP'});
describe('history presentation',()=>{
 it('groups pinned first, then seven calendar days and older records in descending order',()=>{
  const now=new Date('2026-10-12T12:00:00');
  const groups=groupHistorySessions([older,recent,item('boundary','2026-10-06T00:00:00'),item('old-boundary','2026-10-05T23:59:59'),item('pinned','2026-08-01T00:00:00',{isPinned:true}),item('invalid','invalid')],now);
  expect(groups.map(g=>[g.label,g.sessions.map(s=>s.sessionId)])).toEqual([['已置顶',['pinned']],['近 7 天',['recent','boundary']],['更早记录',['old-boundary','older','invalid']]]);
 });
 it('normalizes UTC SQLite dates and safely labels missing dates and result types',()=>{
  expect(formatHistoryTime('2026-10-10 01:49:00')).toBe(formatHistoryTime('2026-10-10T01:49:00Z'));
  expect(formatHistoryTime('invalid')).toBe('时间未知');
  expect(historyResultLabel('DATA_TABLE_VIEW')).toBe('数据表');expect(historyResultLabel('AGUI_RESULT_GROUP')).toBe('组合分析');expect(historyResultLabel(null)).toBe('对话记录');expect(historyResultLabel('RESISTANCE_EVOLUTION_CHART')).toBe('抗药性演变');expect(historyResultLabel('AUTO_GENERATED_REPORT')).toBe('研判报告');
 });
 it('renders ownership, server count, grouped cards, selected state, type badges and only the footer new-session entry',()=>{
  const html=renderToStaticMarkup(<SessionHistoryContent userName="张主任（省疾控消杀所所长）" sessions={[recent,older]} total={20} keyword="" loading={false} error="" currentSessionId="recent" hasMore onKeywordChange={()=>{}} onSearch={()=>{}} onRetry={()=>{}} onLoadMore={()=>{}} onClose={()=>{}} onNewSession={()=>{}} onSelectSession={()=>{}} onManage={()=>{}} onClear={()=>{}}/>);
  for(const text of ['历史研判会话','所属人员','张主任','20','近 7 天','更早记录','16 条对话','趋势分析','空间地图','加载更多','开启新会话'])expect(html).toContain(text);
  expect(html).toContain('aria-current="true"');expect(html).toContain('role="dialog"');expect(html).toContain('aria-modal="true"');
  expect(html).not.toContain('POPULATION_DENSITY_TREND');
  expect(html.split('</header>')[0]).not.toContain('新会话');
  expect(html.split('<footer')[1]).toContain('开启新会话');
 });
 it('distinguishes empty history, no search matches and errors without a false empty-state message',()=>{
  const base={userName:'张主任',sessions:[],total:0,keyword:'',loading:false,error:'',currentSessionId:null,hasMore:false,onKeywordChange:()=>{},onSearch:()=>{},onRetry:()=>{},onLoadMore:()=>{},onClose:()=>{},onNewSession:()=>{},onSelectSession:()=>{},onManage:()=>{},onClear:()=>{}};
  expect(renderToStaticMarkup(<SessionHistoryContent {...base}/>)).toContain('完成第一轮对话后，会话会自动保存在这里');
  const noMatch=renderToStaticMarkup(<SessionHistoryContent {...base} keyword="郑州"/>);expect(noMatch).toContain('没有匹配的会话');const beforeClear=noMatch.split('清空该用户历史')[0];expect(beforeClear.slice(beforeClear.lastIndexOf('<button'))).not.toContain(' disabled=""');
  const error=renderToStaticMarkup(<SessionHistoryContent {...base} error="读取失败"/>);expect(error).toContain('读取失败');expect(error).toContain('重新加载');expect(error).not.toContain('完成第一轮');
 });
});
describe('history list lifecycle',()=>{
 it('uses server totals and loads further pages without losing previous records',async()=>{
  const requests:any[]=[];const list=createSessionHistoryList(async(query,offset)=>{requests.push([query,offset]);return offset?{sessions:[older],total:2}:{sessions:[recent],total:2};});
  await list.load('郑州');expect(list.getState()).toMatchObject({sessions:[recent],total:2,hasMore:true});
  await list.load('郑州',true);expect(requests).toEqual([['郑州',0],['郑州',1]]);expect(list.getState()).toMatchObject({sessions:[recent,older],total:2,hasMore:false});
 });
 it('ignores stale search responses and invalidates an in-flight read after clearing',async()=>{
  let finish!:(v:any)=>void;const list=createSessionHistoryList(async(query)=>query==='旧查询'?new Promise(resolve=>finish=resolve):{sessions:[recent],total:1});
  const pending=list.load('旧查询');await list.load('新查询');finish({sessions:[older],total:99});await pending;expect(list.getState()).toMatchObject({keyword:'新查询',sessions:[recent],total:1});
  const another=list.load('旧查询');list.reset();finish({sessions:[older],total:99});await another;expect(list.getState()).toMatchObject({sessions:[],total:0,loading:false});
 });
 it('keeps loaded records on a failed next page and allows retry; an empty page cannot loop forever',async()=>{
  let fail=true;const list=createSessionHistoryList(async(_query,offset)=>{if(offset&&fail)throw new Error('下一页失败');return offset?{sessions:[],total:2}:{sessions:[recent],total:2};});
  await list.load();await list.load('',true);expect(list.getState()).toMatchObject({sessions:[recent],error:'下一页失败',loading:false,hasMore:true});
  fail=false;await list.load('',true);expect(list.getState()).toMatchObject({sessions:[recent],error:'',hasMore:false});
 });
});
