import { NextRequest, NextResponse } from 'next/server';
import { STANDARD_SKILLS, executeSkillServer } from '@/lib/skills/registry';
import { getVectorDataProvider } from '@/lib/db/sqlite-provider';

export async function GET() {
  return NextResponse.json({
    code: 200,
    success: true,
    total: STANDARD_SKILLS.length,
    skills: STANDARD_SKILLS.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      categoryName: s.categoryName,
      requirementNo: s.requirementNo,
      description: s.description,
      iconName: s.iconName,
      recommendedPrompts: s.recommendedPrompts,
      requiredRoles: s.requiredRoles
    }))
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { skillId, args } = body;

    const provider = getVectorDataProvider();
    const result = await executeSkillServer(skillId, args || {}, provider);

    return NextResponse.json({
      code: 200,
      success: true,
      data: result
    });
  } catch (err: any) {
    console.error('[Skills API Error]', err);
    return NextResponse.json({ code: 500, success: false, error: err.message }, { status: 500 });
  }
}
