# CdcBuddy 移动端 API 开发指南及调用示例 (No. 35)

为支持移动端 App、微信小程序以及现场手持监测终端（PDA）集成疾控病媒生物 AI 能力，CdcBuddy 智能体系统开放了标准 RESTful JSON API。

---

## 一、 API 端点清单

| 接口名称 | HTTP 方法 | 请求路径 | 核心功能 |
| :--- | :---: | :--- | :--- |
| **物种拍照智能识别** | `POST` | `/api/v1/mobile/detect-species` | 上传样本照片 Base64，AI 识别物种、拉丁学名、置信度及形态特征 |
| **监测数据质控校验** | `POST` | `/api/v1/mobile/validate` | 提交前校验气温、湿度、生境与捕获数量的流行病学逻辑一致性 |
| **现场监测记录提交** | `POST` | `/api/v1/mobile/record` | 上传现场监测记录，自动关联行政区划并进入市级审核流 |

---

## 二、 接口详细契约与调用示例

### 1. 物种拍照智能识别接口

* **请求方式**：`POST /api/v1/mobile/detect-species`
* **Content-Type**：`application/json`

#### 请求参数 (JSON Body)
```json
{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "sampleHabitat": "居民区绿化带",
  "location": {
    "latitude": 34.8003,
    "longitude": 113.6627,
    "city": "郑州市",
    "district": "金水区"
  }
}
```

#### 成功响应 (HTTP 200)
```json
{
  "code": 200,
  "success": true,
  "data": {
    "recognizedSpecies": "白纹伊蚊 (Aedes albopictus)",
    "category": "蚊",
    "latinName": "Aedes albopictus (Skuse, 1894)",
    "confidence": 98.4,
    "topPredictions": [
      { "name": "白纹伊蚊", "confidence": 98.4 },
      { "name": "埃及伊蚊", "confidence": 1.2 },
      { "name": "致倦库蚊", "confidence": 0.4 }
    ],
    "morphologyHighlights": [
      "中胸背板中央具醒目单条白色纵纹",
      "后足各跗节具清晰白环",
      "白昼刺叮习性显著"
    ],
    "timestamp": "2026-08-08T08:30:00.000Z"
  },
  "message": "物种识别成功"
}
```

---

### 2. 监测数据质控校验接口

* **请求方式**：`POST /api/v1/mobile/validate`
* **说明**：在移动端表单提交前实时调用，识别异常值与逻辑冲突（如气温<10℃出现高捕获量）。

#### 请求参数 (JSON Body)
```json
{
  "speciesName": "白纹伊蚊",
  "captureCount": 45,
  "weatherTemp": 29.5,
  "weatherHumidity": 78.0,
  "environmentType": "居民区积水点",
  "date": "2026-08-08"
}
```

#### 成功响应 (HTTP 200)
```json
{
  "code": 200,
  "success": true,
  "data": {
    "isValid": true,
    "passedRulesCount": 6,
    "totalRulesCount": 6,
    "warnings": [],
    "status": "VALIDATED"
  },
  "message": "数据质控规则校验全部通过"
}
```

---

### 3. 现场监测记录提交接口

* **请求方式**：`POST /api/v1/mobile/record`

#### 请求参数 (JSON Body)
```json
{
  "dateId": "2026-08-08",
  "speciesName": "白纹伊蚊",
  "captureCount": 45,
  "femaleCount": 38,
  "maleCount": 7,
  "methodName": "诱蚊灯法",
  "locationName": "河南省郑州市金水区未来路街道 #042",
  "latitude": 34.8003,
  "longitude": 113.6627,
  "weatherTemp": 29.5,
  "weatherHumidity": 78.0,
  "recorder": "王工 (金水区监测员)"
}
```

#### 成功响应 (HTTP 200)
```json
{
  "code": 200,
  "success": true,
  "data": {
    "recordId": "REC-MOB-1723098765432",
    "auditStatus": "SUBMITTED",
    "currentAuditor": "市级疾控初审人员",
    "uploadedAt": "2026-08-08T08:35:00.000Z",
    "locationMatched": "河南省郑州市金水区未来路街道监测点 #042",
    "syncToSpatialMap": true
  },
  "message": "现场监测记录已成功上传并进入市级审核流"
}
```

---

## 三、 多语言客户端调用示例代码

### 1. cURL 示例
```bash
# 物种识别
curl -X POST http://localhost:3000/api/v1/mobile/detect-species \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"data:image/jpeg;base64,...","sampleHabitat":"公园绿地"}'

# 质控校验
curl -X POST http://localhost:3000/api/v1/mobile/validate \
  -H "Content-Type: application/json" \
  -d '{"speciesName":"白纹伊蚊","captureCount":45,"weatherTemp":29.5,"weatherHumidity":78}'
```

### 2. JavaScript / TypeScript (Uni-App / 微信小程序 / React Native)
```typescript
// 移动端封装请求工具
export async function detectVectorSpecies(base64Image: string) {
  const response = await fetch('http://localhost:3000/api/v1/mobile/detect-species', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: base64Image,
      sampleHabitat: '绿化带'
    })
  });
  const result = await response.json();
  if (result.success) {
    console.log('识别物种:', result.data.recognizedSpecies, '置信度:', result.data.confidence);
    return result.data;
  } else {
    throw new Error(result.error);
  }
}
```

### 3. Python 现场同步脚本示例
```python
import requests

SERVER_URL = "http://localhost:3000"

def submit_field_record(record_data):
    # 1. 提交前质控校验
    val_resp = requests.post(f"{SERVER_URL}/api/v1/mobile/validate", json=record_data).json()
    if not val_resp.get("data", {}).get("isValid"):
        print("质控警告:", val_resp.get("data", {}).get("warnings"))
        return False
    
    # 2. 正式提交
    sub_resp = requests.post(f"{SERVER_URL}/api/v1/mobile/record", json=record_data).json()
    print("记录已上传，工单号:", sub_resp["data"]["recordId"])
    return True
```
