import { NextRequest } from 'next/server';
import { POST as mainAgentPost } from '@/app/api/agent/dispatch/route';
/** Legacy URL accepts the main Agent interaction protocol; no placeholder actions. */
export const POST=(req:NextRequest)=>mainAgentPost(req);
export const GET=()=>Response.json({protocol:'cdcbuddy-agent-v1',endpoint:'/api/agent/dispatch'});
