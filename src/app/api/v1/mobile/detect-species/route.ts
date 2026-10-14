import {NextRequest,NextResponse} from 'next/server';
import {resolveContext,authStatus} from '@/infrastructure/auth/session';
import {executeSkill} from '@/application/skills/skill-service';
import {IMAGE_REQUEST_BYTES,validateImage} from '@/application/mobile/species-recognition';
/** Bounded JSON input: pixels go only to the vision skill, never to intent selection. */
export async function POST(req:NextRequest){
 try{
  const ctx=resolveContext(req);
  if(ctx.domain!=='vector'||ctx.principal.role==='PUBLIC_VIEWER')return NextResponse.json({success:false,error:'FORBIDDEN_DOMAIN_OR_ROLE'},{status:403});
  if(!req.headers.get('content-type')?.includes('application/json'))return NextResponse.json({success:false,error:'需要 application/json'},{status:415});
  const reader=req.body?.getReader();if(!reader)return NextResponse.json({success:false,error:'缺少图片'},{status:400});
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>IMAGE_REQUEST_BYTES){await reader.cancel();return NextResponse.json({success:false,error:'图片超过4MiB'},{status:413});}chunks.push(value);}}finally{reader.releaseLock();}
  let body:any;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));validateImage(body?.imageDataUrl);}catch{return NextResponse.json({success:false,error:'INVALID_IMAGE: 请上传有效JPEG/PNG/WebP Data URL，最大4MiB'},{status:400});}
  const result=await executeSkill('skill_mobile_assistant_api',{action:'recognize',imageDataUrl:body.imageDataUrl},ctx);
  const success=result.status==='SUCCESS';
  return NextResponse.json({success,status:result.status,data:result.payload,error:result.error}, {status:success?200:result.error?.code.startsWith('FORBIDDEN')?403:['VISION_UNAVAILABLE','LLM_UNAVAILABLE'].includes(result.error?.code??'')?503:result.error?.code==='LLM_TIMEOUT'?504:502});
 }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:'识别失败'},{status:authStatus(error)});}
}
