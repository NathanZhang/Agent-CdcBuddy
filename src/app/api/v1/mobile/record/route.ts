import { NextRequest } from 'next/server';
import { operationResponse } from '@/application/agent/operation-http';
export async function POST(req:NextRequest){let body;try{body=await req.json();}catch{return Response.json({success:false,error:'Invalid JSON'},{status:400});}
 const record={recognitionId:body.recognitionId,city:body.city,district:body.district,category:body.category,speciesName:body.speciesName,captureCount:body.captureCount,weatherTemp:body.weatherTemp,weatherHumidity:body.weatherHumidity,latitude:body.latitude,longitude:body.longitude,street:body.street,habitatType:body.habitatType,methodName:body.methodName};
 return operationResponse(req,{type:'collection.submit',args:{record}},'COLLECTION_RESULT',p=>({...p,recordId:p.record?.submission_id,auditStatus:p.record?.audit_status,currentAuditor:p.record?.auditor_name ?? null,uploadedAt:p.record?.submitted_at,syncToSpatialMap:false}));
}
