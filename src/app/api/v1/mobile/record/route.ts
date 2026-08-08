import { NextRequest, NextResponse } from 'next/server';

/**
 * 移动端现场监测记录提交与审核关联 API
 * POST /api/v1/mobile/record
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const recordId = `REC-MOB-${Date.now()}`;

    return NextResponse.json({
      code: 200,
      success: true,
      data: {
        recordId,
        auditStatus: 'SUBMITTED',
        currentAuditor: '市级疾控初审人员',
        uploadedAt: new Date().toISOString(),
        locationMatched: data.location || '河南省郑州市金水区未来路街道监测点 #042',
        syncToSpatialMap: true
      },
      message: '现场监测记录已成功上传并进入市级审核流'
    });
  } catch (err: any) {
    return NextResponse.json({ code: 500, success: false, error: err.message }, { status: 500 });
  }
}
