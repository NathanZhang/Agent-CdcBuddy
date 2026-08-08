import { NextRequest, NextResponse } from 'next/server';

/**
 * 移动端现场拍照物种识别 API
 * POST /api/v1/mobile/detect-species
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, sampleHabitat, location } = body;

    // 仿真 CDC 物种图像分类深度学习模型推理
    return NextResponse.json({
      code: 200,
      success: true,
      data: {
        recognizedSpecies: '白纹伊蚊 (Aedes albopictus)',
        category: '蚊',
        latinName: 'Aedes albopictus (Skuse, 1894)',
        confidence: 98.4,
        topPredictions: [
          { name: '白纹伊蚊', confidence: 98.4 },
          { name: '埃及伊蚊', confidence: 1.2 },
          { name: '致倦库蚊', confidence: 0.4 }
        ],
        morphologyHighlights: [
          '中胸背板中央具醒目单条白色纵纹',
          '后足各跗节具清晰白环',
          '白昼刺叮习性显著'
        ],
        timestamp: new Date().toISOString()
      },
      message: '物种识别成功'
    });
  } catch (err: any) {
    return NextResponse.json({ code: 500, success: false, error: err.message }, { status: 500 });
  }
}
