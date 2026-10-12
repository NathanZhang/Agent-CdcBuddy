import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { it, expect } from 'vitest';
import { Icd10InferenceCard } from '@/components/ag-ui/Icd10InferenceCard';
import { WaterPipelineGisMap } from '@/components/ag-ui/WaterPipelineGisMap';
import { DensityTrendChart } from '@/components/ag-ui/DensityTrendChart';
import { ThemeProvider } from '@/lib/theme/theme-context';
function render(component: React.ReactNode) { return renderToStaticMarkup(React.createElement(ThemeProvider, null, component)); }
it('empty death-chain results never render a diagnosis or claimed accuracy', () => {
  const html = render(React.createElement(Icd10InferenceCard,{data:{status:'REVIEW_REQUIRED',message:'需人工复核',inferredUnderlyingCause:null}}));
  expect(html).toContain('复核');
  expect(html).not.toContain('I21.1');
  expect(html).not.toContain('96.5%');
});
it('empty water results never render default compliance or fake stations', () => {
  const html = render(React.createElement(WaterPipelineGisMap,{data:{status:'NO_DATA',message:'无数据'}}));
  expect(html).toContain('无数据');
  expect(html).not.toContain('96.2%');
  expect(html).not.toContain('金水区');
});
it('empty time series never renders a default goodness of fit', () => {
  const html = render(React.createElement(DensityTrendChart,{data:{category:'蚊',speciesName:'',city:'不存在市',trend:[],r2Score:null,weatherCorrelation:{tempCorr:null,humidityCorr:null},insights:[]} as any}));
  expect(html).toContain('无数据');
  expect(html).not.toContain('0.88');
});

it('does not relabel non-vector generic values as vector capture measurements',async()=>{const {AnalyticsResultCard}=await import('@/components/ag-ui/AnalyticsResultCard');const html=render(React.createElement(AnalyticsResultCard,{data:{title:'cgMLST',method:'allele-distance-single-link-v1',data:{nodes:[{value:'ST3'}]}}}));expect(html).toContain('ST3');expect(html).not.toContain('捕获量 / 记录');});
