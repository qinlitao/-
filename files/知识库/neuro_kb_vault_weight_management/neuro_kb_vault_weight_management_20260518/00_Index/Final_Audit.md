# Final Audit

## Source Coverage

| source_id | file_name | source_type | coverage_status | note |
|---|---|---|---|---|
| source_001 | PPLX_KB_RULES_V2_COMPLETE.md | rule_doc | complete | 11 个规则章节均进入 Coverage Ledger。 |
| source_002 | PPLX_OBSIDIAN_OUTPUT_CONTRACT_V2.md | rule_doc | complete | 9 个契约章节均进入 Coverage Ledger。 |
| source_003 | 09-同伴行动：“近瘦者瘦”是真的吗？.md | course_note | complete | 正文、划重点、课后任务、预告、评论块均已处理。 |
| source_004 | 10-药物：有没有有效的减肥药？.md | course_note | complete | 正文、划重点、课后任务、预告、评论块均已处理。 |
| source_005 | 11-手术：减肥手术真的靠谱吗？.md | course_note | complete | 正文、划重点、课后任务、预告、评论块均已处理。 |

## Object Counts

| type | count |
|---|---:|
| Episode | 5 |
| Fact | 11 |
| View | 5 |
| Procedure | 5 |
| Task | 5 |
| Total | 31 |

## Edge Integrity Check

| check_item | result |
|---|---|
| edge file present | pass |
| edge count | 102 |
| source_id exists in Object_Inventory | pass |
| target_id exists in Object_Inventory | pass |
| invalid relation_type found | no |
| unsupported relation string found | no |
| primary_domain contains neuro_kb | no |
| blank Coverage Ledger decision found | no |
| residual text like “下一批/待补齐/后续生成” found | no |

## Exclusion List

| source_file | excluded_block | reason |
|---|---|---|
| 09-同伴行动：“近瘦者瘦”是真的吗？.md | 下节预告 | 仅作章节过渡。 |
| 09-同伴行动：“近瘦者瘦”是真的吗？.md | 评论区：纯复述/情绪表达 | 主要是态度与感想，知识增量低。 |
| 10-药物：有没有有效的减肥药？.md | 下节预告 | 仅作章节过渡。 |
| 10-药物：有没有有效的减肥药？.md | 评论区：纯态度表达 | 主要重复“减肥没有捷径”等判断。 |
| 11-手术：减肥手术真的靠谱吗？.md | 下节预告 | 仅作章节过渡。 |
| 11-手术：减肥手术真的靠谱吗？.md | 评论区：纯态度/口号式表达 | 主要是风险感叹与立场表达。 |

## Known Limitations

- `node_weights.json` 与 `edge_weights.json` 仍为初始化空对象，尚未写入独立 QA 权重。
- `qa_logs.jsonl` 为空，尚未写入独立审查日志。
- 评论区采用“明显知识块归并”而非逐条评论对象化处理，高价值评论已并入相关对象，低价值评论已列入排除清单。

## Completion Statement

complete
