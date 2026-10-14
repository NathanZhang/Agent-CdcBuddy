# 60/61 项：ICD-10 解析与 Iris/MUSE 接入

2026-10-14。按用户确认，保持 ICD-10，不用 DORIS/ICD-11 替换现有数据。OCR、短信和 APP 推送未纳入本轮。

## 当前交付与未完成项

60 项已实现原文分行、第一/二部分、多疾病实体、原文偏移、病程、否定/不确定表述以及三位类目候选。复核界面允许修改各行、补充人口学和孕产信息，再解析或调用引擎。所有结果为待复核草稿，正式签署仍在机构登记系统内进行。

61 项已实现调用适配、Windows 原生 worker、版本/哈希检查、退回及异常处理。**当前没有获授权的 Iris 5/MUSE 安装、完整决策表和机构语言字典，因此尚未完成真实引擎执行验收，不能宣称完整 WHO 规则已经运行。** 原生验收脚本明确返回 BLOCKED 和退出码 2。合约测试的替身响应不作为规则引擎证据。

引擎不可用时不再用四条演示因果边或“最后一个匹配疾病”推测根本死因。旧 `config/cause-sequence-rules.json` 已移除。程序没有复制、改写或重新实现 Iris 决策表。

## 用户提供的类目表

源文件：`/Users/nathanzhang/Documents/DEV/AI-CDC/ICD-10_三位类目编码表.xlsx`。

- 工作表 `ICD-10三位类目编码表` 有 2,047 个唯一三位类目；汇总表数量一致，没有公式或重复类目。
- SHA-256：`68604558bdaaa41cf922d01e1f095946935dee26a5bd58d3cc9f202f2a22b4a0`。
- 源表未注明分类年份，原表 U/Z 的章节编号需要来源复核。导入保留原始 `sourceChapter`、行号和原文，不把该文件宣称为最新官方完整分类。
- `scripts/import-icd10-categories.py` 仅使用 Python 标准库读取 XLSX 并生成 `config/mortality/icd10-categories.json`，不修改原表。
- 项目同义词在 `config/mortality/aliases.json`，只给三位类目。例如“急性心肌梗死”输出 I21；“糖尿病”保留 E10—E14 多候选，不默认成 2 型。否定诊断不进入肯定候选清单。
- 不从三位类目补造 `.9` 或六位国家扩展码。人工填写的细分编码也需 Iris 验证。

## 唯一执行路径

主 Agent / 同一技能 → 解析模块 → 配置的原生 worker → Iris.exe / MUSE → 绑定输入和版本的候选 → 人工复核。

仍使用 `skill_icd10_nlp_inference`，别名及调用权限保留；没有第二套 Agent、HTTP 服务或医学规则框架。按证明书编号读取时继续走原有辖区查询。输入不能指定执行命令、数据库路径或规则版本，配置仅由服务端管理。

- 解析：`mode=dictionary`，返回实体、类目候选和缺项，不执行根本死因选择。
- 判定：`mode=graph`，调用 Iris；关系图中的箭头只代表原文填报顺序，不冒充医学支持关系。
- `entryMode=text`：原行交由机构 Iris 语言字典编码；本地类目候选不会被替换成输入编码。
- `entryMode=code`：编码员明确提供 ICD-10 编码，保留同一行多个编码和第二部分；拒绝夹杂未解析文本、国家扩展码或猜测的类目。
- Iris 的 `Ident.Age` 只接受岁或日。月、小时、分钟龄可以保留在复核表单，但提交引擎前必须由填报人确认日龄，不自动换算月份。
- 文本中的病程完整保留并交由机构 `TimeIntervals` 表标准化；中文病程覆盖和多疾病同一病程的退回设置也属于实机验收内容，尚未验证。
- 必须提供年龄、性别（可明确选未知）和死亡方式。缺项、否定/不确定表述、重复位置等先回到复核；不捏造人口学信息。
- Iris 返回 Final / No reject / Automatic、退出码 0、结果标识和编码版本一致才展示候选；应用仍保持 REVIEW_REQUIRED，不自动写回监测库。
- 本轮没有实现机构签名或正式登记写回；界面的勾选是提交前核对，不是专业签署。

## 正式运行环境配置

[Iris 官方发布条款](https://www.bfarm.de/SharedDocs/Downloads/EN/Code-Systems/Iris/iris-terms-conditions-download.pdf?__blob=publicationFile)包含软件和 WHO 内容的使用条件。本项目未代机构接受新许可、下载或分发受限引擎及规则表。已有授权的机构应提供 Iris 5 的 Windows 安装、MUSE 库、匹配的 ICD-10 spec 文件、Iris Tables 数据库及已审核中文语言字典。

原生适配依据 [Iris V5.8.1S1 用户手册](https://salute.regione.emilia-romagna.it/siseps/sanita/rem/files/manuale-di-codifica-automatica-iris-v5-8-1s1.pdf/@@download/file/Manuale%20di%20codifica%20automatica%20Iris%20v5.8.1s1.pdf) 3.9 和 6.2 节的命令行、Ident/MedCod 协议。Windows 原生路径仍需在实际安装版本验证，不能仅凭跨平台合约测试签收。

1. 在专用 Windows 用户下配置 Iris 5，使用专用证书数据库，保留安装提供的空 `aaaReferenceIdent`、`aaaReferenceMedCod` 模板。Iris Options 中的证书库必须与配置文件的 `certificatesDb` 完全一致。
2. 使用与 Iris/Access ODBC 驱动匹配位数的 Python，安装 `pyodbc`。无需给主应用增加数据库驱动依赖。
3. 复制 `config/mortality/iris-native.example.json` 到受控配置目录，按实际安装填写编码年份、精确 `CodingVersion`、规则/字典版本、文件路径与 SHA-256；核对 `ageUnits` 与安装语言一致。只有机构确认已有许可后才设置 `licenseConfirmedByInstitution=true`。
4. 设置服务端 `CDC_IRIS_COMMAND` 为 JSON 参数数组，例如 `["C:\\Python\\python.exe","C:\\CdcBuddy\\scripts\\iris-native-worker.py"]`；设置 `CDC_IRIS_NATIVE_CONFIG` 为该 Windows 配置路径，超时默认 60 秒。Windows worker 自身的 Iris 处理预算为 45 秒。
5. 若主应用仍运行在 macOS/Linux，需要已有获授权 Windows 主机及机构批准的进程传输方式，配置命令调用同一 worker。此仓库不自动建立跨机访问、不上传证明书到第三方、不默认安装兼容层。
6. 在专用 Windows 用户下执行 `python scripts/iris-native-worker.py --check`。它验证本地配置和文件，不等于执行验收。
7. 执行原生验收脚本，检查所有用例、真实 `CodingVersion`、输出编码及退回原因，然后由编码员在对应批次的 MUSE explanation 窗口核对 SP/M 规则日志。

worker 每次创建唯一工作批次，只操作自己的新表，保留批次供审计；不删除既有病例。需要按机构保留期清理这些批次。命令只使用文档明确的 `lname=... year=... -n`，不调用未经确认的 DLL 接口。详细规则日志目前没有文档化的自动导出接口，返回 `ruleTraceAvailable=false` 并提供批次入口；不会从结论倒推或伪造命中规则。

## 验收案例与命令

`tests/fixtures/mortality/acceptance-cases.json` 包含 11 个解析/输入复核案例和 8 个原生引擎案例。后者覆盖单一疾病、顺/逆序链、第二部分参与选择、M3 再检查、性别冲突、无效细分码；预期值为合成病例或所引手册案例，不是伪造的实机返回。正式规则更新后应由编码员评审预期差异，不为让测试通过而修改预期。

```sh
# 本地解析、真实进程边界、UI 和既有技能的回归
npm run test:scientific
npx vitest run tests/refactor/mortality-coding.test.tsx tests/refactor/skill-service.test.ts

# 必须使用真实、已配置的 Iris；没有引擎明确失败，不回放测试响应
.venv/bin/python scripts/verify-iris-native.py
```

合约测试覆盖输入标识串单、ICD-11 混入、版本漂移、缺失文件哈希、引擎退回、有代码但失败、超时和异常输出；这些测试只能证明适配行为。原生脚本检查实际返回，不接受缺运行环境作为通过。两类证据保存在 `docs/reviews/2026-10-14/mortality-coding/`。

第 60/61 项推荐提示词已经更新，并通过主 Agent 实际执行。浏览器验证了原文候选展示、补充信息、重新解析和引擎未配置提示。完整 WHO 规则执行、机构中文词典覆盖、95%准确率、原生详细规则日志自动获取以及正式签署写回均未被宣称完成。

## 本轮实际验证结果

- 科学与数据语义测试：57/57 通过，含 11 个解析验收输入和原生进程适配异常路径。
- 推荐、技能服务、目录、空间回归与复核组件：5 个文件、73 项通过。
- 完整推荐/业务回归：54 个推荐分支及 7 个后续业务检查通过；其中 60 为待复核、61 为引擎未配置、42 为 OCR 暂缓，检查通过不等于这些功能全部验收通过。
- 既有基线：44/44 通过，源数据库未改变。
- TypeScript、ESLint 和生产构建通过。
- 原生 Iris 验收：8 个案例全部 `ENGINE_NOT_CONFIGURED`，总状态 `BLOCKED`，退出码 2；没有真实根本死因输出。
- 浏览器：补充年龄/性别/死亡方式后重新解析，再提交 Iris，页面显示明确的待接入状态；保留了原文、类目候选、病程及复核入口。

日志、源表校验信息、60/61 的主 Agent 执行结果及截图见 [本轮证据目录](reviews/2026-10-14/mortality-coding/)。此前 54 项报告保留为历史执行证据；本轮完整流程回归记录在 `final-flow.log`。
