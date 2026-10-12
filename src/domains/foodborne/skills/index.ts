import {buildDomainSkills} from '../../shared/skill-factory';
import {analyticsSkill} from '../../shared/analytics-skill';
const dates={from:{type:'string'},asOf:{type:'string'}};
export function foodborneSkills(){return buildDomainSkills('foodborne',{
 skill_molecular_trace:analyticsSkill('molecular_trace','allele-distance-single-link-v1','cgMLST 距离与单链接候选簇',{...dates,pathogenId:{type:'string'},clusterId:{type:'string'},threshold:{type:'integer',minimum:0,maximum:1000},sampleLimit:{type:'integer',minimum:1,maximum:100}},'foodborne'),
 skill_foodborne_cluster_detect:analyticsSkill('foodborne_cluster_detect','food-exposure-window-candidates-v1','病例短时窗共同暴露候选',{...dates},'foodborne'),
 skill_food_attribution:analyticsSkill('food_attribution','recorded-food-case-summary-v1','已报告食品及阳性病例统计',{...dates,topN:{type:'integer',minimum:1,maximum:100}},'foodborne')
});}
