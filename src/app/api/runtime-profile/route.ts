import { NextResponse } from 'next/server';
import { getRuntimeProfile } from '@/application/config/runtime-profile';
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json(getRuntimeProfile()); }
