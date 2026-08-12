import henanBorderGeoJSON from './henan-province-border.json';

export interface CityGeoFeature {
  name: string;
  code: string;
  center: [number, number]; // [longitude, latitude]
  districts: { name: string; center: [number, number]; baseRiskLevel: 'low' | 'medium' | 'high' }[];
}

export const HENAN_BORDER_GEOJSON = henanBorderGeoJSON;


export const HENAN_CITIES_GEO: Record<string, CityGeoFeature> = {
  '郑州市': {
    name: '郑州市',
    code: '410100',
    center: [113.6253, 34.7466],
    districts: [
      { name: '金水区', center: [113.6627, 34.8003], baseRiskLevel: 'high' },
      { name: '二七区', center: [113.6396, 34.7233], baseRiskLevel: 'medium' },
      { name: '中原区', center: [113.6062, 34.7523], baseRiskLevel: 'medium' },
      { name: '管城回族区', center: [113.6788, 34.7538], baseRiskLevel: 'high' },
      { name: '惠济区', center: [113.6158, 34.8682], baseRiskLevel: 'low' },
      { name: '中牟县', center: [113.9761, 34.7188], baseRiskLevel: 'low' },
      { name: '新郑市', center: [113.7383, 34.3986], baseRiskLevel: 'medium' },
      { name: '登封市', center: [113.0501, 34.4535], baseRiskLevel: 'low' }
    ]
  },
  '洛阳市': {
    name: '洛阳市',
    code: '410300',
    center: [112.454, 34.6197],
    districts: [
      { name: '洛龙区', center: [112.464, 34.619], baseRiskLevel: 'medium' },
      { name: '西工区', center: [112.433, 34.673], baseRiskLevel: 'low' },
      { name: '涧西区', center: [112.399, 34.658], baseRiskLevel: 'medium' },
      { name: '偃师区', center: [112.793, 34.728], baseRiskLevel: 'low' }
    ]
  },
  '开封市': {
    name: '开封市',
    code: '410200',
    center: [114.3076, 34.7973],
    districts: [
      { name: '鼓楼区', center: [114.354, 34.795], baseRiskLevel: 'low' },
      { name: '龙亭区', center: [114.356, 34.811], baseRiskLevel: 'low' },
      { name: '祥符区', center: [114.437, 34.757], baseRiskLevel: 'medium' }
    ]
  },
  '安阳市': {
    name: '安阳市',
    code: '410500',
    center: [114.3924, 36.0976],
    districts: [
      { name: '文峰区', center: [114.357, 36.091], baseRiskLevel: 'high' },
      { name: '北关区', center: [114.359, 36.121], baseRiskLevel: 'medium' },
      { name: '殷都区', center: [114.309, 36.111], baseRiskLevel: 'medium' },
      { name: '汤阴县', center: [114.358, 35.922], baseRiskLevel: 'high' },
      { name: '林州市', center: [113.815, 36.079], baseRiskLevel: 'low' }
    ]
  },
  '新乡市': {
    name: '新乡市',
    code: '410700',
    center: [113.9268, 35.303],
    districts: [
      { name: '红旗区', center: [113.896, 35.304], baseRiskLevel: 'medium' },
      { name: '卫滨区', center: [113.865, 35.299], baseRiskLevel: 'low' },
      { name: '牧野区', center: [113.908, 35.334], baseRiskLevel: 'low' }
    ]
  },
  '南阳市': {
    name: '南阳市',
    code: '411300',
    center: [112.5283, 32.9908],
    districts: [
      { name: '卧龙区', center: [112.534, 32.986], baseRiskLevel: 'high' },
      { name: '宛城区', center: [112.539, 33.003], baseRiskLevel: 'medium' },
      { name: '邓州市', center: [112.089, 32.684], baseRiskLevel: 'low' }
    ]
  },
  '信阳市': {
    name: '信阳市',
    code: '411500',
    center: [114.0913, 32.147],
    districts: [
      { name: '浉河区', center: [114.065, 32.116], baseRiskLevel: 'high' },
      { name: '平桥区', center: [114.124, 32.101], baseRiskLevel: 'high' },
      { name: '罗山县', center: [114.532, 32.203], baseRiskLevel: 'medium' }
    ]
  },
  '周口市': {
    name: '周口市',
    code: '411600',
    center: [114.697, 33.6264],
    districts: [
      { name: '川汇区', center: [114.649, 33.625], baseRiskLevel: 'medium' },
      { name: '淮阳区', center: [114.887, 33.732], baseRiskLevel: 'low' }
    ]
  },
  '商丘市': {
    name: '商丘市',
    code: '411400',
    center: [115.6564, 34.4142],
    districts: [
      { name: '梁园区', center: [115.644, 34.444], baseRiskLevel: 'medium' },
      { name: '睢阳区', center: [115.653, 34.388], baseRiskLevel: 'low' }
    ]
  },
  '驻马店市': {
    name: '驻马店市',
    code: '411700',
    center: [114.0247, 32.9802],
    districts: [
      { name: '驿城区', center: [114.006, 32.973], baseRiskLevel: 'medium' }
    ]
  },
  '平顶山市': {
    name: '平顶山市',
    code: '410400',
    center: [113.1928, 33.7662],
    districts: [{ name: '新华区', center: [113.294, 33.738], baseRiskLevel: 'low' }]
  },
  '焦作市': {
    name: '焦作市',
    code: '410800',
    center: [113.2418, 35.2159],
    districts: [{ name: '解放区', center: [113.229, 35.244], baseRiskLevel: 'medium' }]
  },
  '许昌市': {
    name: '许昌市',
    code: '411000',
    center: [113.8526, 34.0355],
    districts: [{ name: '魏都区', center: [113.834, 34.025], baseRiskLevel: 'medium' }]
  },
  '漯河市': {
    name: '漯河市',
    code: '411100',
    center: [114.0163, 33.5804],
    districts: [{ name: '郾城区', center: [114.009, 33.587], baseRiskLevel: 'low' }]
  },
  '濮阳市': {
    name: '濮阳市',
    code: '410900',
    center: [115.0292, 35.7619],
    districts: [{ name: '华龙区', center: [115.028, 35.775], baseRiskLevel: 'low' }]
  },
  '鹤壁市': {
    name: '鹤壁市',
    code: '410600',
    center: [114.2978, 35.7483],
    districts: [{ name: '淇滨区', center: [114.298, 35.748], baseRiskLevel: 'low' }]
  },
  '三门峡市': {
    name: '三门峡市',
    code: '411200',
    center: [111.1944, 34.7773],
    districts: [{ name: '湖滨区', center: [111.188, 34.778], baseRiskLevel: 'low' }]
  },
  '济源示范区': {
    name: '济源示范区',
    code: '419001',
    center: [112.59, 35.0904],
    districts: [{ name: '沁园街道', center: [112.59, 35.09], baseRiskLevel: 'low' }]
  }
};
