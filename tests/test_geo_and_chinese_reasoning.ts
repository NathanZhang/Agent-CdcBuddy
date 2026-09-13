import { 
  isProvinceLevel, 
  normalizeCityName, 
  findDistrictInfo, 
  resolveHenanGeoTarget 
} from '../src/lib/geo/henan-geojson';
import { 
  normalizeReasoningToChinese, 
  isMainlyEnglish 
} from '../src/lib/skills/chinese-reasoning-normalizer';
import { executeSkillServer } from '../src/lib/skills/server-executor';

async function runTests() {
  console.log('==== [TEST 1] 思维链 (CoT) 中文化与防英文推演测试 ====');
  const userEnglishCoT = 'The user is requesting to display the province-wide vector-borne disease early warning heat distribution on a map, and to mark all severe (red) warning areas. This corresponds to the skill_spatial_early_warning tool (spatiotemporal dynamic multi-dimensional early warning and map heat analysis).';
  console.log('原始英文 CoT 是否判断为英文:', isMainlyEnglish(userEnglishCoT));
  const convertedCoT = normalizeReasoningToChinese(userEnglishCoT, '在地图上展示全省当前的病媒生物预警热力分布，标记所有严重（红色）预警区域。');
  console.log('中文化转换后结果:\n', convertedCoT);
  if (isMainlyEnglish(convertedCoT)) {
    throw new Error('转换后的推演仍然包含大量英文！');
  }
  console.log('✅ CoT 中文化测试通过！\n');

  console.log('==== [TEST 2] 河南省地理视口自适应解析引擎测试 ====');
  // 1. 全省全域
  const t1 = resolveHenanGeoTarget('河南省全域', undefined);
  console.log('全省全域判定级别:', t1.level, '中心点:', t1.center, 'zoom:', t1.zoom);
  if (t1.level !== 'province' || t1.zoom !== 6.8) throw new Error('全省全域解析错误！');

  // 2. 空参数 (全省默认)
  const t2 = resolveHenanGeoTarget('', '');
  console.log('空参数判定级别:', t2.level, '中心点:', t2.center);
  if (t2.level !== 'province') throw new Error('空参数全省解析错误！');

  // 3. 地级市（别名无“市”字）
  const t3 = resolveHenanGeoTarget('洛阳', undefined);
  console.log('洛阳地市判定:', t3.level, '规范城市:', t3.cityName, 'zoom:', t3.zoom);
  if (t3.cityName !== '洛阳市' || t3.zoom !== 9.8) throw new Error('地市归一化错误！');

  // 4. 独立县区（未给地市）
  const t4 = resolveHenanGeoTarget('河南省全域', '汤阴县');
  console.log('汤阴县反查:', t4.level, '反查城市:', t4.cityName, '反查区县:', t4.districtName, 'zoom:', t4.zoom);
  if (t4.cityName !== '安阳市' || t4.districtName !== '汤阴县' || t4.zoom !== 12.0) throw new Error('汤阴县反查错误！');

  // 5. 地市加区县
  const t5 = resolveHenanGeoTarget('信阳市', '浉河区');
  console.log('浉河区反查:', t5.level, '反查城市:', t5.cityName, '反查区县:', t5.districtName, 'zoom:', t5.zoom);
  if (t5.cityName !== '信阳市' || t5.zoom !== 12.0) throw new Error('区县定位错误！');
  console.log('✅ 地理引擎五大场景全部验证通过！\n');

  console.log('==== [TEST 3] 服务端执行 skill_spatial_early_warning 红色严重预警过滤 ====');
  const spatialResult = await executeSkillServer('skill_spatial_early_warning', {
    city: '河南省全域',
    severity: 'red'
  });
  console.log('返回视图类型:', spatialResult.type);
  console.log('返回城市名称:', spatialResult.city);
  console.log('过滤后的预警总数:', spatialResult.alerts.length);
  const nonRedAlerts = spatialResult.alerts.filter((a: any) => a.level !== 'red');
  console.log('非红色预警数量:', nonRedAlerts.length);
  if (nonRedAlerts.length > 0) {
    throw new Error('严重预警过滤失效，仍包含非红色预警！');
  }
  console.log('所有返回预警点等级均为红色:', spatialResult.alerts.every((a: any) => a.level === 'red'));
  console.log('✅ 服务端严重预警过滤测试通过！\n');

  console.log('🎉 所有自动化验证全部 100% 通过！');
}

runTests().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
