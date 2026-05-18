# README

本 vault 面向 Obsidian 使用，采用 Fact / View / Episode / Procedure / Task 五类对象组织“科学减肥知识库”。

## 目录说明

- `00_Index/`：索引、来源清单、覆盖台账、对象清单、最终审计。
- `01_Domains/`：领域定义文件。
- `02_Objects/`：知识对象文件，按 Fact / View / Episode / Procedure / Task 分目录保存。
- `03_Relations/`：对象间关系边。
- `04_Weights/`：节点与边权重。
- `05_Logs/`：QA 日志与已处理日志 ID。
- `06_Templates/`：对象模板。
- `99_Assets/`：静态资源占位目录。

## 关系约束

仅使用以下关系：
- supports
- derived_from
- learned_from
- applies_to
- conflicts_with
- revises

## 当前范围

当前 vault 覆盖：
- 规则文件 2 份
- 课程来源 3 份
- 主题包括社交支持、药物减肥、减肥手术
