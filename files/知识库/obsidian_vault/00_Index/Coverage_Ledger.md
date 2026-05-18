# Coverage Ledger

| source_file | section | decision | target_ids | reason |
|---|---|---|---|---|
| PPLX_OBSIDIAN_OUTPUT_CONTRACT_V2.md [file:1] | 1. Required Vault Shape [file:1] | merged | 00_Index/*; 01_Domains/weight_management/README.md; 02_Objects/*; 03_Relations/edges.jsonl | 作为结构契约，已并入本批目录布局与必需索引文件设计。[file:1] |
| PPLX_OBSIDIAN_OUTPUT_CONTRACT_V2.md [file:1] | 2. File Output Format [file:1] | merged | 全部输出文件 | 作为文件模式契约，已用于本轮所有“文件路径 + fenced code block”输出格式。[file:1] |
| PPLX_OBSIDIAN_OUTPUT_CONTRACT_V2.md [file:1] | 3. ID Rules [file:1] | merged | fact_20260518_*; view_20260518_*; episode_20260518_*; procedure_20260518_*; task_20260518_*; edge_20260518_* | 作为编号规则，已用于全部对象与关系 ID。[file:1] |
| PPLX_OBSIDIAN_OUTPUT_CONTRACT_V2.md [file:1] | 4. Required Index Files [file:1] | merged | 00_Index/Source_Manifest.md; 00_Index/Coverage_Ledger.md; 00_Index/Object_Inventory.md; 00_Index/Final_Audit.md | 已完整生成所要求索引文件。[file:1] |
| PPLX_OBSIDIAN_OUTPUT_CONTRACT_V2.md [file:1] | 5. Required Templates [file:1] | merged | 06_Templates/fact.md; 06_Templates/view.md; 06_Templates/episode.md; 06_Templates/procedure.md; 06_Templates/task.md | 已生成五类对象模板。[file:1] |
| PPLX_OBSIDIAN_OUTPUT_CONTRACT_V2.md [file:1] | 6. JSONL Edges [file:1] | merged | 03_Relations/edges.jsonl | 已按允许关系集合输出 JSONL 关系文件。[file:1] |
| PPLX_OBSIDIAN_OUTPUT_CONTRACT_V2.md [file:1] | 7. Weight And Log Files [file:1] | merged | 04_Weights/node_weights.json; 04_Weights/edge_weights.json; 05_Logs/qa_logs.jsonl; 05_Logs/processed_log_ids.json | 已按初始空状态生成权重与日志文件。[file:1] |
| PPLX_OBSIDIAN_OUTPUT_CONTRACT_V2.md [file:1] | 8. Batch State [file:1] | merged | 00_Index/Batch_State.md | 已生成批次状态文件并置于本轮末尾。[file:1] |
| PPLX_OBSIDIAN_OUTPUT_CONTRACT_V2.md [file:1] | 9. Final Batch Rule [file:1] | merged | 00_Index/Final_Audit.md | 已执行最终批检查项并写入 Final Audit。[file:1] |
| PPLX_KB_RULES_V2_COMPLETE.md [file:2] | 1. Domain Policy [file:2] | merged | 01_Domains/weight_management/README.md; 全部对象 frontmatter | 已将主领域确定为 weight_management，而非 neuro_kb。[file:2][file:3][file:4] |
| PPLX_KB_RULES_V2_COMPLETE.md [file:2] | 2. Completeness Rule [file:2] | merged | 00_Index/Coverage_Ledger.md; 00_Index/Final_Audit.md | 已对各来源章节给出 object、merged 或 excluded 决策。[file:2] |
| PPLX_KB_RULES_V2_COMPLETE.md [file:2] | 3. Object Types [file:2] | merged | 02_Objects/Facts/*; 02_Objects/Views/*; 02_Objects/Episodes/*; 02_Objects/Procedures/*; 02_Objects/Tasks/* | 已严格使用五类核心对象建模。[file:2] |
| PPLX_KB_RULES_V2_COMPLETE.md [file:2] | 4. Must-Create Source Anchors [file:2] | merged | episode_20260518_001; episode_20260518_002 | 已为两份主要课程来源各建立一个 Episode 锚点。[file:2][file:3][file:4] |
| PPLX_KB_RULES_V2_COMPLETE.md [file:2] | 5. Write Rules [file:2] | merged | 全部领域对象 | 已优先写入高复用结论、判断、流程与任务，而未机械摘抄原文。[file:2] |
| PPLX_KB_RULES_V2_COMPLETE.md [file:2] | 6. Exclusion Rules [file:2] | merged | Coverage Ledger 中全部 excluded 行 | 已将下节预告与评论区个体经验按规则排除或不单独入库。[file:2][file:3][file:4] |
| PPLX_KB_RULES_V2_COMPLETE.md [file:2] | 7. Coverage Ledger Format [file:2] | merged | 00_Index/Coverage_Ledger.md | 已按规定字段输出覆盖台账。[file:2] |
| PPLX_KB_RULES_V2_COMPLETE.md [file:2] | 8. Object Frontmatter [file:2] | merged | 全部对象文件 | 已为所有对象写入统一 frontmatter 字段。[file:2] |
| PPLX_KB_RULES_V2_COMPLETE.md [file:2] | 9. Relations [file:2] | merged | 03_Relations/edges.jsonl; 全部对象 Links | 已仅使用 supports、derived_from、learned_from、applies_to、conflicts_with、revises 关系集合。[file:2] |
| PPLX_KB_RULES_V2_COMPLETE.md [file:2] | 10. External Weights [file:2] | merged | 04_Weights/node_weights.json; 04_Weights/edge_weights.json | 已保持权重外置且对象 frontmatter 不含权重。[file:2] |
| PPLX_KB_RULES_V2_COMPLETE.md [file:2] | 11. Final Audit Requirements [file:2] | merged | 00_Index/Final_Audit.md | 已输出 Source Manifest、Coverage Ledger、Object Inventory、Edge Integrity、Exclusion List 与 Known Limitations。[file:2] |
| 09-同伴行动：“近瘦者瘦”是真的吗？.md [file:3] | 开篇情境：减肥不仅靠个人努力 [file:3] | object | view_20260518_001; episode_20260518_001 | 形成“环境设计是减肥杠杆”的核心观点，并保留来源锚点。[file:3] |
| 09-同伴行动：“近瘦者瘦”是真的吗？.md [file:3] | 谁会影响我们减肥？ [file:3] | object | fact_20260518_001; view_20260518_001 | 形成社交聚类与三度影响力的核心事实和解释框架。[file:3] |
| 09-同伴行动：“近瘦者瘦”是真的吗？.md [file:3] | 构建你的减肥社交圈 [file:3] | object | fact_20260518_002; procedure_20260518_001; task_20260518_001 | 形成家庭、朋友、社群三层圈层的可执行流程。[file:3] |
| 09-同伴行动：“近瘦者瘦”是真的吗？.md [file:3] | 让社交圈为自己的减肥助力 [file:3] | merged | procedure_20260518_001; view_20260518_001 | “浸染 + 主动分享”的操作细节已合并到流程与观点对象。[file:3] |
| 09-同伴行动：“近瘦者瘦”是真的吗？.md [file:3] | 划重点 / 任务 [file:3] | merged | task_20260518_001; procedure_20260518_001 | 课程任务已吸收为可复用 Task 与执行步骤。[file:3] |
| 09-同伴行动：“近瘦者瘦”是真的吗？.md [file:3] | 下节预告 [file:3] | excluded |  | 仅为课程串联提示，不具长期知识复用价值。[file:3][file:2] |
| 09-同伴行动：“近瘦者瘦”是真的吗？.md [file:3] | 评论区 [file:3] | excluded |  | 以个体经验、情绪反馈与零散案例为主，证据层级不稳定，不单独入库。[file:3][file:2] |
| 10-药物：有没有有效的减肥药？.md [file:4] | 开篇与三类药物框架 [file:4] | object | view_20260518_002; episode_20260518_002 | 建立“药物不是捷径”的总框架与来源锚点。[file:4] |
| 10-药物：有没有有效的减肥药？.md [file:4] | 第一类：号称能减肥的保健品 [file:4] | object | fact_20260518_003 | 形成对减肥保健品的明确边界判断。[file:4] |
| 10-药物：有没有有效的减肥药？.md [file:4] | 第二类：专门上市的减肥药物 [file:4] | object | fact_20260518_004; fact_20260518_005; view_20260518_002 | 形成正规减肥药整体效果、风险与奥利司他边界。[file:4] |
| 10-药物：有没有有效的减肥药？.md [file:4] | 使用减肥药的注意事项 [file:4] | object | procedure_20260518_002; task_20260518_002; view_20260518_002 | 形成用药资格判断与长期管理流程。[file:4] |
| 10-药物：有没有有效的减肥药？.md [file:4] | 第三类：具有减肥副作用的药物 [file:4] | object | fact_20260518_006; view_20260518_002 | 形成二甲双胍减重效果与适用边界。[file:4] |
| 10-药物：有没有有效的减肥药？.md [file:4] | 划重点 / 任务 [file:4] | merged | task_20260518_002; procedure_20260518_002 | 已合并为药物评估任务与流程对象。[file:4] |
| 10-药物：有没有有效的减肥药？.md [file:4] | 下节预告 [file:4] | excluded |  | 仅为课程串联提示，不具长期知识复用价值。[file:4][file:2] |
| 10-药物：有没有有效的减肥药？.md [file:4] | 评论区 [file:4] | excluded |  | 多为提问、观点或零散个案，不作为稳定医学知识单元入库。[file:4][file:2] |
