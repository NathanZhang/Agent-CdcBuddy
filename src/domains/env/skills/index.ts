import {buildDomainSkills} from '../../shared/skill-factory';
import {analyticsSkill} from '../../shared/analytics-skill';
const dates={from:{type:'string'},asOf:{type:'string'}};
export function envSkills(){return buildDomainSkills('env',{
 skill_water_safety_eval:analyticsSkill('water_safety_eval','observed-water-summary-v1','实际水质样本统计',dates,'env'),
 skill_sewage_pathogen_trace:analyticsSkill('sewage_pathogen_trace','calendar-aligned-pearson-v1','污水日历滞后探索统计',{...dates,pathogen:{enum:['诺如病毒','新冠病毒','肠道病毒']},maxLag:{type:'integer',minimum:0,maximum:30}},'env'),
 skill_river_basin_pollution_chain:analyticsSkill('river_basin_pollution_chain','descriptive-metals-moran-v1','河流浓度统计与可选空间自相关',{...dates,basinName:{type:'string'},weights:{type:'object',additionalProperties:false,required:['sectionNames','matrix'],properties:{sectionNames:{type:'array',minItems:3,maxItems:50,items:{type:'string'}},matrix:{type:'array',minItems:3,maxItems:50,items:{type:'array',items:{type:'number',minimum:0}}}}}},'env')
});}
