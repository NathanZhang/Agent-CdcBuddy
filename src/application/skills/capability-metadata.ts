import {marketplacePolicy} from '@/lib/skills/marketplace';
import {recommendationsForSkill} from '@/lib/config/recommended-prompts';
import {authorizeSkill} from '@/infrastructure/auth/authorization';
import type {UserRole} from '@/lib/rbac/types';
import type {SkillDefinition} from '@/contracts/skill-definition';
import {STANDARD_SKILLS} from '@/lib/skills/registry';
const publicDescriptions:Record<string,string>={
 'skill_arima_forecast':'使用当前授权数据预测非负月度指标，展示历史与预测曲线及时间留出误差。至少需要18个连续月份；缺失数据不会自动补零，预测不代表业务风险等级。',
 'skill_report_templates':'查看、创建和维护个人报告模板，管理模板版本、报告周期与章节配置，并在生成报告时复用。',
 'skill_composable_workflow':'组合空间扫描、成员选择、特征矩阵、聚类和历史序列分析，保存任务进度，支持查看、取消与续跑。未经验证的 LSTM 模型不可用。'
};
const partialMethods=new Set(['vector-validated-assessment-v1','foodborne-validated-assessment-v1','foodborne-dashboard-assessment-v1','env-validated-assessment-v1','chronic-validated-assessment-v1','vector-warning-workflow-v1','foodborne-warning-workflow-v1','env-warning-workflow-v1','chronic-warning-workflow-v1','vision-species-recognition-v1','persistent-scientific-dag-v1','artifact-scientific-kernels-v1','scientific-artifact-foundation-v1','autoregression-seasonal-capture-v1','gradient-boosting-capture-v1','method-separated-kmeans-capture-v1','observed-bioassay-records-v1','pcr-record-pair-association-v1','observed-capture-idw-v1','observed-transmission-inputs-v1','conditional-poisson-circular-scan-v1','food-exposure-window-candidates-v1','allele-distance-single-link-v1','recorded-food-case-summary-v1','observed-water-summary-v1','calendar-aligned-pearson-v1','descriptive-metals-moran-v1','death-certificate-rule-candidates-v1','district-centroid-dbscan-v1','injury-observed-counts-v1','icd10-iris-mortality-v2','persisted-descriptive-report-v1','persistent-evidence-workflow-v1']);
/** Maturity describes the implemented method, not professional requirement acceptance. */
export function withCapabilityMetadata(skill:SkillDefinition):SkillDefinition {
 const planned=skill.availability==='planned';
 return {...skill,...(planned?{description:'该能力尚未实现并验证。'}:{}),implementationStatus:planned?'planned':partialMethods.has(skill.method)?'partial':'implemented',validationStatus:planned?'unvalidated':skill.id==='skill_vector_backtest'?'observed-backtest':'contract',validationEvidence:planned?[]:skill.id==='skill_arima_forecast'?['tests/refactor/shared-forecast.test.tsx','tests/scientific/test_shared_forecast.py']:skill.method.includes('assessment')||skill.method.includes('warning-workflow')?['scripts/run-requirement-flows.cjs','tests/scientific/test_requirement_models.py']:skill.method==='vision-species-recognition-v1'?['tests/refactor/mobile-vision.test.ts','docs/reviews/2026-10-14/requirement-acceptance/live-vision.json']:['persistent-scientific-dag-v1','artifact-scientific-kernels-v1'].includes(skill.method)?['tests/refactor/scientific-dag.test.ts','tests/scientific/test_artifact_kernels.py']:skill.method==='scientific-artifact-foundation-v1'?['tests/refactor/scientific-foundation.test.ts']:skill.id==='skill_vector_backtest'?['docs/reviews/2026-10-12/t8-vector-acceptance.md']:['tests/refactor/skill-service.test.ts']};
}
export function publicSkillMetadata(skill:SkillDefinition){
 const roles:UserRole[]=['PROVINCIAL_ADMIN','CITY_EXPERT','DISTRICT_SURVEILLANCE','PUBLIC_VIEWER'];
 const requiredRoles=roles.filter(role=>{try{authorizeSkill(skill,{action:'list'},{runId:'catalog',domain:skill.domain,deploymentTier:'local',principal:{userId:'catalog',organizationId:'catalog',role,mode:'authenticated',domainGrants:[skill.domain],jurisdiction:role==='CITY_EXPERT'?{city:'郑州市'}:role==='DISTRICT_SURVEILLANCE'?{city:'郑州市',district:'金水区'}:{},permissions:{professionalReview:true}}});return true;}catch{return false;}});
 const {execute:_,...definition}=skill;const decoration=STANDARD_SKILLS.find(s=>s.id===skill.id);const backtest=skill.id==='skill_vector_backtest';const recommendations=recommendationsForSkill(skill.domain,skill.id);
 return {...definition,...(publicDescriptions[skill.id]?{description:publicDescriptions[skill.id]}:{}),marketplace:marketplacePolicy(skill),category:decoration?.category??(backtest?'forecast':'nlq'),categoryName:decoration?.categoryName??(backtest?'模型回测':'通用操作'),iconName:decoration?.iconName??'Layers',recommendedPrompts:recommendations,requiredRoles,requiresProfessionalReview:skill.allowedOperations.includes('review'),parametersSchema:skill.inputSchema,requirementNo:skill.requirementIds.length?`No. ${skill.requirementIds.join('/')}`:undefined};
}
