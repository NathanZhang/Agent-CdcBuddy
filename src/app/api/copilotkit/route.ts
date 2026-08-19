import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';
import { BuiltInAgent } from '@copilotkit/runtime/v2';
import { createOpenAI } from '@ai-sdk/openai';
import { NextRequest } from 'next/server';

const apiKey = process.env.SILICONFLOW_API_KEY || 'missing-siliconflow-api-key';
const baseURL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
const modelName = process.env.SILICONFLOW_MODEL || 'Qwen/Qwen3.6-27B';

// 对接硅基流动 SiliconFlow (兼容 OpenAI 规范)
const siliconflow = createOpenAI({
  baseURL,
  apiKey,
});

const runtime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: siliconflow(modelName),
      prompt: '您是 CdcBuddy 疾控病媒生物监测预警智能体。您协助疾控专家研判河南省病媒生物生态数据、病原体检测与抗药性。思考过程与回复必须全程使用中文。',
    }),
  },
  actions: [
    {
      name: 'queryPopulationDynamics',
      description: '查询并预测病媒生物种群密度季节消长趋势与未来3个月预测曲线',
      parameters: [
        { name: 'category', type: 'string', description: '病媒大类: 蚊, 蝇, 蟑螂, 鼠, 蜱, 恙螨' },
        { name: 'speciesName', type: 'string', description: '物种名称' },
        { name: 'city', type: 'string', description: '城市名称' }
      ],
      handler: async (args: any) => {
        const { category, speciesName, city } = args;
        return { success: true, message: `已触发 ${city || '全省'} ${category || '蚊'}类种群动态预测模型` };
      }
    },
    {
      name: 'querySpatialEarlyWarning',
      description: '在地图组件上展示时空风险热力与分级预警点位',
      parameters: [
        { name: 'city', type: 'string', description: '城市名称' },
        { name: 'severity', type: 'string', description: '预警等级: all, yellow, orange, red' }
      ],
      handler: async (args: any) => {
        const { city, severity } = args;
        return { success: true, message: `已更新 ${city || '全省'} 空间地理预警地图` };
      }
    }
  ]
});

const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
  runtime,
  endpoint: '/api/copilotkit'
});

export const POST = async (req: NextRequest) => {
  return handleRequest(req);
};

export const GET = async (req: NextRequest) => {
  return handleRequest(req);
};

export const OPTIONS = async (req: NextRequest) => {
  return handleRequest(req);
};
