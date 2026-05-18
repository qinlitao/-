# Coverage Plan

## Coverage Strategy

当前批次先处理治理文件以确定输出契约、对象模型、关系集合与最终审计要求，再处理两份课程内容文件，分别建立来源锚点、对象抽取计划与排除策略。[file:1][file:2][file:3][file:4]

覆盖策略遵循“每个来源、每个主要章节、每个明显知识块都必须进入 object / merged / excluded 三选一”的完整性规则。[file:2]

## Source-Level Plan

| source_file | planned_handling | notes |
|---|---|---|
| PPLX_OBSIDIAN_OUTPUT_CONTRACT_V2.md [file:1] | merged | 不生成领域对象，作为 vault 输出结构和文件格式约束源。[file:1] |
| PPLX_KB_RULES_V2_COMPLETE.md [file:2] | merged | 不生成领域对象，作为 domain policy、completeness rule 与 object model 约束源。[file:2] |
| 09-同伴行动：“近瘦者瘦”是真的吗？.md [file:3] | object | 生成 1 个 Episode、2 个 Fact、1 个 View、1 个 Procedure、1 个 Task。[file:3] |
| 10-药物：有没有有效的减肥药？.md [file:4] | object | 生成 1 个 Episode、4 个 Fact、1 个 View、1 个 Procedure、1 个 Task。[file:4] |

## Section-Level Plan

- 09 课程的“开篇情境”“谁会影响我们减肥”“构建你的减肥社交圈”“让社交圈为自己的减肥助力”“划重点/任务”进入对象抽取或合并计划。[file:3]
- 09 课程的“下节预告”“评论区”计划排除并记录原因。[file:3][file:2]
- 10 课程的“三类药物框架”“第一类保健品”“第二类正规减肥药”“使用减肥药的注意事项”“第三类具有减肥副作用的药物”“划重点/任务”进入对象抽取或合并计划。[file:4]
- 10 课程的“下节预告”“评论区”计划排除并记录原因。[file:4][file:2]

## Object Distribution Plan

对象创建以“每个主要来源至少一个 Episode”为先，然后再生成 Fact、View、Procedure、Task，并确保所有领域对象可追溯到来源锚点。[file:2]

当前计划总对象数为 14 个，覆盖两份课程中的核心可复用知识块。[file:3][file:4]
