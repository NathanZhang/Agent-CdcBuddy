# CdcBuddy 自定义 Skills 对话扩展指南 (Meta-Skill Builder)

CdcBuddy 智能体系统具备**动态技能自扩展能力 (Meta-Skill Engine)**。除了系统出厂预置的 13 项标准业务技能外，疾控中心管理人员与业务专家无需编写代码，**只需通过自然语言对话即可快速构建、验证并注册新的分析技能**。

---

## 一、 对话式创建技能核心机制

```
[用户自然语言对话输入]
"帮我创建一个新技能：专门统计近三年安阳市蜱虫携带恙虫病东方体的月度分布并在地图上标出高危村镇"
       │
       ▼
[Meta-Skill Builder 语义解析中枢]
 1. 意图提取: 城市(安阳市)、物种(蜱虫)、病原(恙虫病东方体)、时间窗口(近3年)、展现形式(地图+统计表)
 2. SQL 编译: 自动组装安全的 SELECT 关联查询与聚合维度
 3. AG-UI 绑定: 匹配最佳生成式界面模板 (Map / Bar / Pie / Table)
       │
       ▼
[技能注册中心 (Skills Registry)] ──> [即刻生效，在 Skills 集市中可永久调用]
```

---

## 二、 对话实操演练与示例

### 案例 1：创建特定市县病原体时空分布技能
* **用户对话输入**：
  > “帮我创建一个新技能：专门统计近三年安阳市蜱虫携带恙虫病东方体的月度分布并在地图上标出高危村镇。”
* **智能体执行流程**：
  1. 智能体触发 `skill_meta_custom_builder`；
  2. 自动生成技能元数据：
     - 技能名称：`豫北蜱虫携带恙虫病东方体时空分布分析`
     - 技能分类：`自定义技能 (Custom)`
     - 自动编译 SQL：
       ```sql
       SELECT l.city, l.district, l.street, strftime('%Y-%m', d.date_id) as month_str, count(*) as pos_cnt
       FROM fact_pathogen_detection d
       JOIN dim_pathogen p ON d.pathogen_id = p.pathogen_id
       JOIN dim_species s ON d.species_id = s.species_id
       JOIN dim_location l ON d.location_id = l.location_id
       WHERE l.city = '安阳市' AND s.category = '蜱' AND p.pathogen_name LIKE '%恙虫病%' AND d.pcr_result = '阳性'
       GROUP BY l.city, l.district, l.street, month_str
       ORDER BY pos_cnt DESC;
       ```
  3. 主工作区渲染 **新技能创建成功与试跑数据卡片**；
  4. 技能即刻注册至本地及系统技能集市，后续可通过 “执行 豫北蜱虫携带恙虫病东方体时空分布分析” 直接调度。

### 案例 2：创建跨区域杀虫剂抗药性对比技能
* **用户对话输入**：
  > “创建一个自定义技能：对比郑州与洛阳两地德国小蠊对各类杀虫剂的抗药性差异与 LC50。”
* **智能体执行流程**：
  1. 解析对比维度，自动关联 `fact_insecticide_resistance`；
  2. 绑定柱状对比图与列表渲染器；
  3. 赋予技能唯一 ID `custom_skill_resistance_compare` 并保存。

---

## 三、 自定义技能的管理与维护

1. **技能查看**：点击界面右上角 **“Skills 技能集市 (14)”** 按钮，切换至“自定义技能”标签页，即可查看全部由用户会话创建的技能；
2. **权限分配**：自定义技能默认对创建者角色（及上级省级管理员）开放；
3. **即时调用**：在任何会话中，直接输入技能名称即可由 Copilot 自动识别并执行。
