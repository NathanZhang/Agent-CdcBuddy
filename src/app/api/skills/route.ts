import { NextRequest, NextResponse } from 'next/server';
import { STANDARD_SKILLS } from '@/lib/skills/registry';
import { executeSkillServer } from '@/lib/skills/server-executor';
import { getAppBusinessProvider } from '@/lib/db/app-business-provider';

export async function GET() {
  try {
    const bizProvider = getAppBusinessProvider();
    const customSkillsData = await bizProvider.getAllCustomSkills();
    
    const customSkills = customSkillsData.map(cs => ({
      id: cs.skill_id,
      name: cs.name,
      category: cs.category || 'custom',
      categoryName: '自定义技能',
      description: cs.description,
      iconName: 'Sparkles',
      badgeColor: 'pink',
      recommendedPrompts: cs.recommended_prompts ? cs.recommended_prompts.split(';') : [`执行 ${cs.name}`],
      requiredRoles: ['PROVINCIAL_ADMIN', 'CITY_EXPERT', 'DISTRICT_SURVEILLANCE'],
      isCustom: true,
      sqlQuery: cs.sql_query,
      chartType: cs.chart_type,
      createdBy: cs.created_by,
      createdAt: cs.created_at
    }));

    const standardSkills = STANDARD_SKILLS.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      categoryName: s.categoryName,
      requirementNo: s.requirementNo,
      description: s.description,
      iconName: s.iconName,
      badgeColor: s.badgeColor,
      recommendedPrompts: s.recommendedPrompts,
      requiredRoles: s.requiredRoles,
      isCustom: false
    }));

    const total = standardSkills.length + customSkills.length;

    return NextResponse.json({
      code: 200,
      success: true,
      total,
      standardCount: standardSkills.length,
      customCount: customSkills.length,
      standardSkills,
      customSkills,
      skills: [...standardSkills, ...customSkills]
    });
  } catch (err: any) {
    console.error('[Skills API GET Error]', err);
    return NextResponse.json({
      code: 200,
      success: true,
      total: STANDARD_SKILLS.length,
      standardCount: STANDARD_SKILLS.length,
      customCount: 0,
      skills: STANDARD_SKILLS,
      customSkills: []
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { skillId, args } = body;

    const result = await executeSkillServer(skillId, args || {});

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

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const skillId = searchParams.get('skillId');

    if (!skillId) {
      return NextResponse.json({ code: 400, success: false, message: '缺少 skillId 参数' }, { status: 400 });
    }

    const bizProvider = getAppBusinessProvider();
    const success = await bizProvider.deleteCustomSkill(skillId);

    return NextResponse.json({
      code: 200,
      success,
      message: success ? '技能删除成功' : '未找到指定技能或已删除'
    });
  } catch (err: any) {
    console.error('[Skills API DELETE Error]', err);
    return NextResponse.json({ code: 500, success: false, error: err.message }, { status: 500 });
  }
}

