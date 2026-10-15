# 54项场景输入与业务核对

默认来源的ready仅指登记的输入检查，不代表模型或业务验收。Mock业务回归通过实际计算与持久化执行，意图/规划/汇总使用明确的协议测试替身，不作为54次真实LLM运行证据。60/61保留人工复核；42暂缓；35/58需实际采集输入。

| 编号 | 领域 | 场景 | 默认输入检查 | 缺项或说明 | Mock业务回归 |
|---|---|---|---|---|---|
| 23 | vector | 种群动态模型 | missing | 完整60个月训练输入 | SUCCESS / 通过 |
| 24 | vector | 种群识别模型 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 25 | vector | 抗药性预测模型 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 26 | vector | 病原携带风险评估模型 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 27 | vector | 动态预警分析 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 28 | vector | 预警推送信息 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 29 | vector | 处置闭环信息 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 30 | vector | 密度预测模型 | missing | fact_vector_exposure | SUCCESS / 通过 |
| 31 | vector | 传播风险评估模型 | missing | fact_vector_exposure | SUCCESS / 通过 |
| 32 | vector | 抗药性演化预测 | missing | fact_vector_exposure | SUCCESS / 通过 |
| 33 | vector | 自然语言问答 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 34 | vector | 专题报告信息 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 35 | vector | AI助手信息 | manual-upload | 需上传图片 | SUCCESS / 通过 |
| 36 | foodborne | 聚集性病例识别模型 | missing | fact_food_exposure | SUCCESS / 通过 |
| 37 | foodborne | 风险预测模型 | missing | fact_food_forecast_inputs | SUCCESS / 通过 |
| 38 | foodborne | 病原体溯源分析 | missing | fact_food_exposure | SUCCESS / 通过 |
| 39 | foodborne | 处置建议信息 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 40 | foodborne | 动态监测大屏 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 41 | foodborne | 专题报告信息 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 42 | env | OCR 引擎 | deferred | OCR暂缓 | SUCCESS / 通过 |
| 43 | env | 数据标化模型 | missing | fact_env_raw_samples、正常、缺失、负值及单位差异 | SUCCESS / 通过 |
| 44 | env | 风险评估模型 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 45 | env | 趋势分析模型 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 46 | env | 疫情关联分析 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 47 | env | 溯源追踪信息 | missing | fact_sewage_network | SUCCESS / 通过 |
| 48 | env | 健康风险映射信息 | missing | fact_venue_scores | SUCCESS / 通过 |
| 49 | env | 动态评级信息 | missing | fact_venue_scores、六维评分输入 | SUCCESS / 通过 |
| 50 | env | 污染物暴露评估 | missing | fact_env_activity | SUCCESS / 通过 |
| 51 | env | 极端天气预警 | missing | fact_env_activity | SUCCESS / 通过 |
| 52 | env | 跨介质风险传递 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 53 | env | 生态健康响应 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 54 | env | 预警模型信息 | missing | fact_env_alerts | SUCCESS / 通过 |
| 55 | env | 精准干预建议 | missing | fact_env_alerts | SUCCESS / 通过 |
| 56 | env | 监测报告信息 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 57 | env | 情景模拟推演 | missing | fact_env_intervention_inputs | SUCCESS / 通过 |
| 58 | env | 移动智能助手 | missing | fact_env_mobile_tasks | SUCCESS / 通过 |
| 59 | chronic | 数据校验模型 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 60 | chronic | 数据解析模型 | ready | 输入计数符合检查；仍须运行模型核对 | REVIEW_REQUIRED / 通过 |
| 61 | chronic | 根本死因判定模型 | ready | 输入计数符合检查；仍须运行模型核对 | REVIEW_REQUIRED / 通过 |
| 62 | chronic | 死亡图谱识别模型 | missing | fact_chronic_followup | SUCCESS / 通过 |
| 63 | chronic | 罕见死因检测模型 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 64 | chronic | 慢性病发病预测 | missing | fact_chronic_followup | SUCCESS / 通过 |
| 65 | chronic | 并发症关联分析 | missing | fact_chronic_followup | SUCCESS / 通过 |
| 66 | chronic | 筛查精准化推荐 | missing | fact_chronic_followup | SUCCESS / 通过 |
| 67 | chronic | 伤害类型聚类 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 68 | chronic | 风险因素归因 | missing | fact_injury_risk_inputs | SUCCESS / 通过 |
| 69 | chronic | 聚集性事件识别 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 70 | chronic | 预警信号信息 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 71 | chronic | 风险分级信息 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 72 | chronic | 监测报告信息 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 73 | chronic | 报告模板信息 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 74 | chronic | 死因干预 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 75 | chronic | 慢性病干预 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
| 76 | chronic | 伤害干预 | ready | 输入计数符合检查；仍须运行模型核对 | SUCCESS / 通过 |
