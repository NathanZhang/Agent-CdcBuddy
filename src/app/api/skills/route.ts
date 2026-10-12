import { operationResponse } from '@/application/agent/operation-http';
import { NextRequest, NextResponse } from 'next/server';
import { listSkillDefinitions } from '@/application/skills/skill-service';
import { getServerDomain } from '@/application/config/runtime-profile';
import { STANDARD_SKILLS } from '@/lib/skills/registry';
import { createDevelopmentContext } from '@/lib/skills/server-executor';
import { dispatch,collectDispatch } from '@/application/dispatch/dispatch-service';
import { normalizeInteraction,toLegacyResult } from '@/application/dispatch/legacy-adapter';
import { getAppBusinessProvider } from '@/lib/db/app-business-provider';

export async function GET(req:NextRequest){
 return operationResponse(req,{type:'catalog.list'},'SKILL_CATALOG',payload=>{
   const standardSkills=payload.standardSkills.map((definition:any)=>({...STANDARD_SKILLS.find(s=>s.id===definition.id),...definition,execute:undefined,parametersSchema:definition.inputSchema,category:STANDARD_SKILLS.find(s=>s.id===definition.id)?.category ?? 'common',categoryName:STANDARD_SKILLS.find(s=>s.id===definition.id)?.categoryName ?? '通用交互',iconName:STANDARD_SKILLS.find(s=>s.id===definition.id)?.iconName ?? 'Sparkles',recommendedPrompts:STANDARD_SKILLS.find(s=>s.id===definition.id)?.recommendedPrompts ?? [definition.name],visibility:'public',isCustom:false}));
   const customSkills=payload.customSkills.map((s:any)=>({...s,id:s.skill_id,sqlQuery:s.sql_query,chartType:s.chart_type,createdBy:s.created_by,createdAt:s.created_at,recommendedPrompts:s.recommended_prompts?.split(';') ?? [],isCustom:true}));
   return {standardSkills,customSkills,skills:[...standardSkills,...customSkills],total:standardSkills.length+customSkills.length};
 });
}

export async function POST(req: NextRequest) {
  try {
    const body=await req.json();
    if(typeof body.skillId!=='string'||!body.skillId) return NextResponse.json({success:false,error:'缺少 skillId'},{status:400});
    const interaction=normalizeInteraction({kind:'skill',promptText:`执行技能 ${body.skillId}，参数：${JSON.stringify(body.args ?? {})}`,resourceRef:{type:'skill',id:body.skillId,action:'execute'},attachments:[{type:'operation-input',args:body.args ?? {}}]});
    const ctx=createDevelopmentContext();ctx.signal=req.signal;
    const turn=await collectDispatch(dispatch(interaction,ctx));const result=toLegacyResult(turn);
    return NextResponse.json({...result,data:result.generativeView});
  } catch (error) {return NextResponse.json({success:false,status:'FAILED',data:null,error:error instanceof Error?error.message:'执行失败'},{status:400});}
}

export async function PUT(req:NextRequest){let body;try{body=await req.json();}catch{return NextResponse.json({success:false,error:'Invalid JSON'},{status:400});}return operationResponse(req,{type:'skill.update',id:body.skillId,args:{name:body.name,description:body.description,sqlQuery:body.sqlQuery,chartType:body.chartType,visibility:body.visibility,recommendedPrompts:body.recommendedPrompts}},'SKILL_CATALOG');}
export async function DELETE(req:NextRequest){return operationResponse(req,{type:'skill.delete',id:new URL(req.url).searchParams.get('skillId') ?? ''},'SKILL_CATALOG');}
