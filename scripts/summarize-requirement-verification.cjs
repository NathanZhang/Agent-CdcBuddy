/** Render recorded real-model turns through both actual presentation modes.
 * This is an evidence report, never a scenario execution route or LLM substitute.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const scenes=require('../config/requirement-scenarios.json');
const bundle=path.resolve(process.argv[2]??'.mock-data/requirement-chat');
const output=path.resolve(process.argv[3]??'docs/reviews/2026-10-14/prompt-pipeline');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const sources=['vector','foodborne','env','chronic'].map(domain=>{
 const file=path.join(bundle,'live-'+domain+'.json'),raw=fs.readFileSync(file);
 return {file,sha256:sha(raw),...JSON.parse(raw)};
});
const rows=scenes.map(scene=>{
 const turn=sources.flatMap(s=>s.results).find(r=>r.requirementId===scene.requirementId);
 if(!turn)throw Error('Missing recorded turn: '+scene.requirementId);
 const recordedRendering=JSON.parse(fs.readFileSync(path.join(bundle,'presentation-verification.json'),'utf8')).results.find(r=>r.runId===turn.runId);
 const renderings=recordedRendering?.renderings??[];
 const currentPrompt=turn.prompt===scene.prompt;
 return {requirementId:scene.requirementId,domain:scene.domain,title:scene.title,prompt:turn.prompt,currentPrompt,
  passed:turn.passed&&currentPrompt&&renderings.length===2&&renderings.every(r=>r.promptVisible&&r.conclusionVisible&&r.resultVisible),
  status:turn.status,expectedStatus:turn.expectedStatus,runId:turn.runId,session:turn.session,elapsedMs:turn.elapsedMs,
  llmMode:turn.llmMode,thinkingEnabled:turn.thinkingEnabled,reasoningEffort:turn.reasoningEffort,
  phaseCalls:turn.phaseCalls,intentSummary:turn.intentSummary,checks:turn.checks,renderings,
  skills:turn.skillRuns.map(r=>({id:r.skillId,args:r.args,status:r.result.status,method:r.result.method,datasets:r.result.datasets,payloadSha256:sha(JSON.stringify(r.result.payload??null)),error:r.result.error})),
  modelExchanges:turn.modelExchanges,replyText:turn.replyText,answerDiagnostics:turn.answerDiagnostics,error:turn.error,
  limitation:scene.limitation};
});
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'live-verification.json'),JSON.stringify({generatedAt:new Date().toISOString(),purpose:'real-model-mock-business-acceptance-not-clinical-validation',sourceFiles:sources.map(s=>({path:s.file,sha256:s.sha256,executedAt:s.executedAt})),passed:rows.filter(r=>r.passed).length,total:rows.length,results:rows},null,2));
const lines=['# 54 项真实模型与双模式展示核对','','普通工作台和浮窗栏为实际组件对真实模型记录的服务端渲染检查；浏览器实际点击另见截图。42项仅核对OCR暂缓，60/61项必须人工复核（61项尚缺正式Iris/MUSE），35/58项等待用户提供照片或采样输入，不将入口展示视作样本已提交。','', '|需求|领域|场景|意图|执行及业务检查|研判|工作台/浮窗渲染|业务状态|总结果|','|---|---|---|---|---|---|---|---|---|'];
for(const r of rows)lines.push(`|${r.requirementId}|${r.domain}|${r.title}|${r.phaseCalls.includes('intent')?'通过':'失败'}|${r.checks.filter(c=>!c.passed).map(c=>c.name).join('、')||'通过'}|${r.checks.find(c=>c.name==='model-conclusion-with-evidence')?.passed?'通过':'待修复'}|${r.renderings.every(v=>v.resultVisible&&v.promptVisible&&v.conclusionVisible)?'通过':'失败'}|${r.status}|${r.passed?'通过':'未通过'}|`);
fs.writeFileSync(path.join(output,'matrix.md'),lines.join('\n')+'\n');
console.log(`${rows.filter(r=>r.passed).length}/${rows.length} real-model turns and both renderer modes verified`);
if(rows.some(r=>!r.passed))process.exitCode=1;
