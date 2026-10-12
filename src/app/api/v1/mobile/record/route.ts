import { NextRequest, NextResponse } from 'next/server';
import { getAppBusinessProvider } from '@/lib/db/app-business-provider';

/**
 * 移动端现场监测记录提交与审核关联 API
 * POST /api/v1/mobile/record
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const required = ['userId','userName','city','district','category','speciesName'];
    if (required.some(key => typeof data[key] !== 'string' || !data[key].trim()) || typeof data.captureCount !== 'number' || !Number.isSafeInteger(data.captureCount) || data.captureCount < 0) {
      return NextResponse.json({success:false,error:'Missing or invalid sampling evidence'}, {status:400});
    }
    for (const key of ['latitude','longitude','weatherTemp','weatherHumidity','aiConfidence']) {
      if (data[key] !== undefined && (typeof data[key] !== 'number' || !Number.isFinite(data[key]))) return NextResponse.json({success:false,error:`Invalid ${key}`},{status:400});
    }
    const bizProvider = getAppBusinessProvider();

    const record = await bizProvider.submitMobileRecord({
      user_id: data.userId,
      user_name: data.userName,
      city: data.city,
      district: data.district,
      street: data.street,
      latitude: data.latitude,
      longitude: data.longitude,
      image_url_base64: data.imageBase64,
      recognized_species: data.recognizedSpecies,
      ai_confidence: data.aiConfidence,
      category: data.category,
      species_name: data.speciesName,
      capture_count: data.captureCount,
      weather_temp: data.weatherTemp,
      weather_humidity: data.weatherHumidity,
      habitat_type: data.habitatType,
      method_name: data.methodName
    });

    return NextResponse.json({
      code: 200,
      success: true,
      data: {
        recordId: record.submission_id,
        auditStatus: record.audit_status,
        currentAuditor: record.auditor_name ?? null,
        uploadedAt: record.submitted_at,
        locationMatched: `${record.city}${record.district}${record.street || ''}`,
        syncToSpatialMap: false
      },
      message: '现场监测记录已成功持久化写入业务数据库，，等待后续审核'
    });
  } catch (err: any) {
    return NextResponse.json({ code: 500, success: false, error: err.message }, { status: 500 });
  }
}
