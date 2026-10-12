export type QueryVisualization =
  | { kind: 'bar' | 'line'; xKey: string; yKey: string; unit: string }
  | { kind: 'map'; latKey: string; lonKey: string; labelKey: string; valueKey: string; unit: string };

const key = { type: 'string', minLength: 1, maxLength: 100 };
export const queryVisualizationSchema = {
  description: '根据用户要求选择图形，字段键必须与本次SQL结果列名完全一致。bar为分组柱状图，line为按日期排序的时间折线图，map为点位地图（实际经纬度、点位标签与数值）。所有图形同时附明细表，无需重复查询。unit填写实际指标单位。',
  oneOf: [
    { type: 'object', additionalProperties: false, required: ['kind', 'xKey', 'yKey', 'unit'], properties: { kind: { enum: ['bar', 'line'] }, xKey: key, yKey: key, unit: key } },
    { type: 'object', additionalProperties: false, required: ['kind', 'latKey', 'lonKey', 'labelKey', 'valueKey', 'unit'], properties: { kind: { const: 'map' }, latKey: key, lonKey: key, labelKey: key, valueKey: key, unit: key } },
  ],
};
