/** Real LLM smoke test. Run with an explicitly configured environment. */
import { createDevelopmentContext } from '../src/lib/skills/server-executor';
import { dispatch,collectDispatch } from '../src/application/dispatch/dispatch-service';
async function main(){
 const ctx=createDevelopmentContext();
 const result=await collectDispatch(dispatch({interactionId:'manual-smoke',kind:'conversation',userInput:process.argv[2] ?? '查询当前领域监测记录总数，返回实际数据来源。'},ctx));
 console.log(JSON.stringify(result,null,2));
 if(result.status!=='SUCCESS'||!result.skillRuns.length||!result.agui.length)process.exitCode=1;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
