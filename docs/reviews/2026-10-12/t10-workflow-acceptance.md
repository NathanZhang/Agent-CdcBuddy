# T10 持久业务闭环

实际主线链路：真实LLM提交任务 run 487c9552-3668-41dd-bcb8-6913af0eaba3 → SQLite队列 job 8cbab814-2029-40b5-ba8f-4f6d8fe38e27 → 独立Node worker启动主线Agent/真实LLM/只读统计Skill run 21697800-6241-4c76-9d6f-06382d1c6874 → 实测郑州市平均捕获量3.006480117820324大于用户显式阈值1 → WAITING_REVIEW → 真实LLM审批 run b7bfe171-0a9e-41cc-8229-3ad3017fe646 → 工单OPEN → outbox站内收件箱实际入箱。原始结果见refactor-evidence/t10/live-*.json。未声称该阈值具有专业预警效力、已消杀、已复测或区域风险解除。

独立状态机测试：提交幂等/不同输入冲突、租约排他与过期重取、错误心跳拒绝、真实持久Skill证据、审批前零工单、拒绝终止、审批重复不建重复工单、复测必须引用实际采集记录、未到24小时时窗拒绝、未达标保持OPEN、实际达标证据才RESOLVED、重复记录不重复核销、站内通知真实入箱。LangGraph审批中断通过SQLite检查点跨实例恢复并绑定analysisRunId，未通过审批没有任何派工节点。

统一Jobs Skills和API均经主线Agent；旧Python规则巡检显式不可用。周期配置持久化，调度事件按scheduleId+时间点幂等提交到同一队列；独立worker以120秒租约、30秒心跳、最多3次尝试运行。失败运行也归档审计。AG-UI支持读取任务、审批和引用采集记录复测。

局限：当前单worker/SQLite起步；用户阈值仅工程规则；复测字段限captures/record，人工采集证据仍需专业审核，不能代表区域风险核销。短信/APP没有适配器，不能标DELIVERED。旧44项的直接SQL UPDATE工单“验收”已删除，只检查旧表兼容；新状态机测试才是闭环证据。阶段门禁108 TS、29数学、13集成、44兼容通过，事实库未改变。
