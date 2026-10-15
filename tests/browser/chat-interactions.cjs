// Run against a local dev server: BASE_URL=http://127.0.0.1:3201 node tests/browser/chat-interactions.cjs
// Requires Playwright (or NODE_PATH pointing to an existing installation).
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

async function main(){
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  // Exercise the real browser transport and controller with a manually paced SSE response.
  await page.addInitScript(()=>{
   const originalFetch=window.fetch.bind(window);
   window.fetch=async(input,init)=>{
    if(String(input)!=='/api/agent/stream-dispatch')return originalFetch(input,init);
    let controller;
    const body=new ReadableStream({start(value){controller=value;}});
    window.chatFixture={
     emit(event,data){controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));},
     finish(data){this.emit('finish',{success:true,runId:crypto.randomUUID(),interactionId:'fixture',status:'SUCCESS',agui:[],skillRuns:[],...data});controller.close();}
    };
    return new Response(body,{headers:{'Content-Type':'text/event-stream'}});
   };
  });
  await page.goto(process.env.BASE_URL||'http://127.0.0.1:3201');
  const input=page.getByRole('textbox',{name:'对话指令',exact:true});
  await input.waitFor();
  const chat=page.getByRole('region',{name:'对话记录',exact:true});
  const emit=async(event,data)=>{
   await page.evaluate(({event,data})=>window.chatFixture.emit(event,data),{event,data});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  };
  const finish=async(data)=>{
   await page.evaluate(data=>window.chatFixture.finish(data),data);
   await page.getByRole('button',{name:'发送',exact:true}).waitFor();
  };
  const send=async(text)=>{
   await page.evaluate(()=>{delete window.chatFixture;});
   await input.fill(text);await page.getByRole('button',{name:'发送',exact:true}).click();
   await page.waitForFunction(()=>Boolean(window.chatFixture));
  };
  const longText=Array.from({length:70},(_,index)=>`第 ${index+1} 行监测数据核对结果。`).join('\n\n');
  await send('建立历史记录');await finish({replyText:longText});
  await send('继续研判');await emit('reasoning_start',{});await emit('reasoning_chunk',{text:longText,replace:true});
  const card=chat.getByRole('button',{name:/推理过程/}).last();
  assert.equal(await card.getAttribute('aria-expanded'),'true');
  // Nested reasoning follows its own tail without moving the conversation.
  const reasoning=chat.getByRole('region',{name:'模型推理内容'});
  await emit('reasoning_chunk',{text:'\n新推理片段'});
  assert(await reasoning.evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop<=1));
  await card.click();assert.equal(await card.getAttribute('aria-expanded'),'false');
  await chat.evaluate(el=>{el.scrollTop=120;el.dispatchEvent(new Event('scroll'));});
  const before=await chat.evaluate(el=>el.scrollTop);
  await emit('reasoning_chunk',{text:'\n折叠后的持续推理更新'});
  assert.equal(await chat.evaluate(el=>el.scrollTop),before,'hidden reasoning must not move chat');
  await emit('tool_call_result',{toolId:'query',success:true,summary:'结果返回'});
  assert.equal(await chat.evaluate(el=>el.scrollTop),before,'progress must not move chat');
  await emit('reasoning_end',{durationMs:500});
  await emit('reasoning_start',{});await emit('reasoning_chunk',{text:'\n技能返回后的继续推理'});
  assert.equal(await card.getAttribute('aria-expanded'),'false','later reasoning stages preserve manual collapse');
  assert.equal(await chat.evaluate(el=>el.scrollTop),before);
  await emit('content_chunk',{text:'正在汇总研判结论。',replace:true});
  assert.equal(await chat.evaluate(el=>el.scrollTop),before,'reading history pauses reply following');
  await card.click();assert.equal(await card.getAttribute('aria-expanded'),'true');
  await emit('reasoning_end',{durationMs:1234});
  assert.equal(await card.getAttribute('aria-expanded'),'true','wait until the whole interaction finishes');
  await finish({replyText:'研判已完成。',reasoningText:longText,reasoningDuration:1234});
  assert.equal(await card.getAttribute('aria-expanded'),'false','finished reasoning automatically collapses');
  await card.click();assert.equal(await card.getAttribute('aria-expanded'),'true','completed reasoning can be reopened');

  await send('验证重新跟随');await emit('content_chunk',{text:longText,replace:true});
  assert(await chat.evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop<=1),'new user turn resumes following');
  await chat.evaluate(el=>{el.scrollTop=80;el.dispatchEvent(new Event('scroll'));});
  await emit('content_chunk',{text:'\n追加结论'});
  assert.equal(await chat.evaluate(el=>el.scrollTop),80);
  await chat.evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'));});
  await emit('content_chunk',{text:'\n继续跟随结论'});
  assert(await chat.evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop<=1));
  await finish({replyText:longText});

  // The synchronized floating chat must have the same independent scrolling behavior.
  await page.getByRole('button',{name:/展开【/}).click();
  const widget=page.getByRole('region',{name:'浮窗对话记录',exact:true});
  await widget.waitFor();
  assert(await widget.evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop<=1));
  const widgetInput=page.getByRole('textbox',{name:'浮窗对话指令',exact:true});
  await page.evaluate(()=>{delete window.chatFixture;});
  await widgetInput.fill('浮窗验证');await page.getByRole('button',{name:'浮窗发送',exact:true}).click();
  await page.waitForFunction(()=>Boolean(window.chatFixture));
  await emit('reasoning_start',{});await emit('reasoning_chunk',{text:longText,replace:true});
  const widgetCard=widget.getByRole('button',{name:/推理过程/}).last();
  await widgetCard.click();
  await widget.evaluate(el=>{el.scrollTop=90;el.dispatchEvent(new Event('scroll'));});
  await emit('reasoning_chunk',{text:'\n浮窗隐藏推理'});
  assert.equal(await widget.evaluate(el=>el.scrollTop),90);
  await widgetCard.click();await finish({replyText:'浮窗完成',reasoningText:longText});
  assert.equal(await widgetCard.getAttribute('aria-expanded'),'false');
  await page.getByRole('button',{name:'关闭浮窗',exact:true}).click();

  for(const size of [{width:1440,height:900},{width:1024,height:600},{width:390,height:844}]){
   await page.setViewportSize(size);
   const layout=await page.evaluate(()=>{
    const root=document.documentElement,body=document.body;
    const chat=document.querySelector('[aria-label="对话记录"]');
    const form=document.querySelector('[aria-label="对话指令"]').closest('form');
    window.scrollTo(0,200);
    return {rootHeight:root.scrollHeight,height:innerHeight,rootWidth:root.scrollWidth,width:innerWidth,scrollY,bodyTop:body.getBoundingClientRect().top,overflow:getComputedStyle(root).overflowY,overscroll:getComputedStyle(root).overscrollBehaviorY,chatHeight:chat.clientHeight,formBottom:form.getBoundingClientRect().bottom};
   });
   assert.equal(layout.rootHeight,layout.height);
   assert.equal(layout.rootWidth,layout.width);
   assert.equal(layout.scrollY,0);assert.equal(layout.bodyTop,0);
   assert.equal(layout.overflow,'hidden');assert.equal(layout.overscroll,'none');
   assert(layout.chatHeight>0);assert(layout.formBottom<=size.height);
  }
  console.log('PASS: reasoning scroll isolation, completion collapse, history reading, floating chat, and responsive viewport');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
