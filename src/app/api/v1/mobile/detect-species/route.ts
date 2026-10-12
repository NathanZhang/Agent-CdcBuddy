import { NextRequest } from 'next/server';
import { operationResponse } from '@/application/agent/operation-http';
/** Vision inference is unavailable; never invent a species/confidence from ignored pixels. */
export async function POST(req:NextRequest){return operationResponse(req,{type:'collection.detect-species',prompt:'请求识别上传照片中的病媒物种；如果没有实际图像识别技能，请明确说明不可用，不得猜测物种或置信度。'},'SPECIES_RECOGNITION_RESULT');}
