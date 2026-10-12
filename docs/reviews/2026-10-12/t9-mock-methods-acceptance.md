# T9 三域数据驱动验收

污水使用实际日历日期配对 Pearson（每对至少4点，常量不可定义，缺测不补齐）；逐处理厂计算，医院关联尚未验证，不声称提前预警效果。河流浓度实际聚合；库无断面拓扑，默认空间统计数据不足。用户提供矩阵时计算真实 Moran 和可重现置换概率，矩阵来源仍未验证。慢病使用真实 sklearn haversine DBSCAN，区县中心聚类不代表个体风险；死亡月计数、伤害构成和短时窗候选实际计算。

cgMLST 使用非负整数等长位点距离，不比较不同病原，单链接候选内部最大距离可能超过边阈值。无效位点拒判；不声称源头、传播链、平均98.4%。食源暴露仅报告实际计数；无未暴露对照不计算因果OR。死亡证明规则输出人工复核候选，准确率空值，不读取Mock质控标签代替算法。

独立对照4项：6天日期滞后、常量拒判、Moran参考公式/数值扰动、DBSCAN坐标扰动、跨病原/无效位点。RED日志和门禁见 refactor-evidence/t9-*.log。三域全部保持 origin=mock，工程数学正确不代表真实业务效果。完整DLNM/慢病GBDT/生命表/ROI/情景模型/食源LSTM仍不可用，不能签收完整功能。

方法依据：[SciPy Pearson](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.pearsonr.html)、[sklearn DBSCAN](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.DBSCAN.html)、[PySAL Moran实现](https://github.com/pysal/esda/blob/main/esda/moran.py)。

兼容44项中原固定成功断言改为实际性质或拒判，仅表示接口/状态兼容。Vitest并发限制为2并设置20秒测试预算，避免同时启动多个科学进程造成无意义5秒超时；生产runner预算未扩大。
