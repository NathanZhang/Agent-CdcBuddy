import React from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {it,expect} from 'vitest';
import {AnalyticsResultCard} from '@/components/ag-ui/AnalyticsResultCard';
import {DataTableComponent} from '@/components/ag-ui/DataTableComponent';
import {MarkdownRenderer} from '@/components/common/MarkdownRenderer';
import {sourceLabels} from '@/features/workbench/result-adapter';

const species={title:'物种构成、多样性与探索性 K-Means',method:'method-separated-kmeans-capture-v1',status:'SUCCESS',qualityFlags:['exploratory-clusters-not-risk-classes'],data:{items:[{speciesName:'小家鼠',latinName:'Mus musculus',category:'鼠',totalCount:7,percentage:70,cityBreakdown:[{city:'郑州市',count:7}]},{speciesName:'褐家鼠',latinName:'Rattus norvegicus',category:'鼠',totalCount:3,percentage:30,cityBreakdown:[{city:'郑州市',count:0},{city:'南阳市',count:3}]}],dominantSpecies:'小家鼠',shannonWienerIndex:0.610864302,clusters:[]}};
it('renders composition as a Chinese overview and city comparison, with truthful capture units and precision',()=>{
 const html=render(<AnalyticsResultCard data={species}/>);
 expect(html).toContain('捕获总数');expect(html).toContain('物种构成');expect(html).toContain('地市物种对比');
 expect(html).toContain('0.6109');expect(html).toContain('70.00%');expect(html).not.toContain('>speciesName<');expect(html).not.toContain('>cityBreakdown<');
 expect(html).toContain('未提供');expect(html).toContain('>0<');expect(html).toContain('Mus musculus');
 expect(html).toContain('簇编号不代表风险等级');
});
it('keeps nested result arrays in a table with expandable evidence and localizes status and units',()=>{
 const html=render(<AnalyticsResultCard data={{title:'预测',method:'gradient-boosting-capture-v1',data:{groups:[{city:'郑州市',status:'INSUFFICIENT_DATA',unit:'captures/record',sampleCount:0,forecasts:[],trainingWindow:{start:'2023-01',end:'2023-03',periods:3}}]}}}/>);
 expect(html).toContain('<table');expect(html).toContain('<details');expect(html).toContain('数据不足');expect(html).toContain('捕获量 / 记录');expect(html).toContain('起始时间');expect(html).not.toContain('>trainingWindow<');
});
it('localizes queried field names without replacing zero, missing values, scientific names or unknown columns',()=>{
 const html=render(<DataTableComponent data={[{species_name:'Rattus tanezumi',count:0,percentage:35.37941034316095,custom_metric:null}]}/>);
 expect(html).toContain('物种名称');expect(html).toContain('数量');expect(html).toContain('35.38%');expect(html).toContain('>0<');expect(html).toContain('未提供');expect(html).toContain('custom_metric');expect(html).toContain('Rattus tanezumi');
});
it('labels data sources in Chinese while retaining provenance',()=>{
 expect(sourceLabels([{id:'v',domain:'vector',origin:'observed',version:'snapshot-1',asOf:'2026-10-12',schemaVersion:'1'}])).toEqual(['病媒生物：实测数据 · snapshot-1']);
});
it('renders structured answers including headings, emphasis, aligned tables and geo links',()=>{
 const html=render(<MarkdownRenderer content={'## 主要结论\n\n**小家鼠**占比最高。\n\n| 地市 | 捕获量 |\n| --- | ---: |\n| 郑州市 | 7 |\n\n- 核对采样方法\n\n> 捕获量不等于标准密度。\n\n[郑州市](geo:34.75,113.62)'}/>);
 expect(html).toContain('<h3');expect(html).toContain('<strong');expect(html).toContain('<table');expect(html).toContain('text-right');expect(html).toContain('<blockquote');expect(html).toContain('点击在地图定位');
});
it('preserves Chinese query aliases and named species columns without technical fallback prefixes',()=>{
 const html=render(<DataTableComponent data={[{'郑州市':7,'小家鼠':3,'物种数量':2}]}/>);
 expect(html).not.toContain('扩展字段');expect(html).toContain('郑州市');
});
it('does not invent dominance or diversity when all observed captures are zero',()=>{
 const html=render(<AnalyticsResultCard data={{...species,data:{items:[{speciesName:'小家鼠',totalCount:0,percentage:null,cityBreakdown:[{city:'郑州市',count:0}]}],dominantSpecies:null,shannonWienerIndex:null,clusters:[]}}}/>);
 expect(html).toContain('>0<');expect(html).toContain('未提供 / 未评估');expect(html).not.toContain('0.00%');expect(html).not.toContain('NaN');
});
