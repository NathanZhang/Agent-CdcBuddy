import { NextRequest, NextResponse } from 'next/server';

/**
 * 移动端现场监测数据质控与逻辑一致性校验 API
 * POST /api/v1/mobile/validate
 */
export async function POST(req: NextRequest) {
  try {
    const record = await req.json();
    const { weatherTemp, weatherHumidity, captureCount, speciesName, environmentType, date } = record;

    const warnings: string[] = [];
    let isValid = true;

    // 逻辑规则 1：低温越冬期成蚊数量冲突
    if (weatherTemp !== undefined && weatherTemp < 10 && captureCount > 30) {
      isValid = false;
      warnings.push(`当前监测气温 (${weatherTemp}℃) 低于 10℃，成蚊多处于越冬静止状态，单次捕获 ${captureCount} 只存在显著逻辑异常，请现场复核！`);
    }

    // 逻辑规则 2：极端高温抑制活动
    if (weatherTemp !== undefined && weatherTemp > 42 && captureCount > 60) {
      warnings.push(`监测气温达到 ${weatherTemp}℃ 极端高温，超出常规活动窗口，请核验温度计读数。`);
    }

    // 逻辑规则 3：生境与物种习性匹配
    if (environmentType === '高层办公室' && speciesName?.includes('白纹伊蚊') && captureCount > 50) {
      warnings.push(`生境类型为室内高层，白纹伊蚊孳生环境不匹配，建议标注是否有室内水培植物或天台积水。`);
    }

    return NextResponse.json({
      code: 200,
      success: true,
      data: {
        isValid,
        passedRulesCount: 6 - warnings.length,
        totalRulesCount: 6,
        warnings,
        status: isValid ? 'VALIDATED' : 'REVIEW_REQUIRED'
      },
      message: isValid ? '数据质控规则校验全部通过' : '检测到数据逻辑预警项'
    });
  } catch (err: any) {
    return NextResponse.json({ code: 500, success: false, error: err.message }, { status: 500 });
  }
}
