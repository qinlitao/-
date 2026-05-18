# Domain Analysis

## Primary Domain

根据两份课程来源的主题，当前知识库的 primary domain 确定为 `weight_management`，中文名称为“科学减肥知识库”。[file:3][file:4][file:2]

原因在于两个核心来源分别讨论减肥中的社交影响与减肥中的药物使用边界，均属于体重管理与肥胖干预范畴，而不是知识库方法论本身。[file:3][file:4][file:2]

## Framework Domain

`neuro_kb` 仅作为 framework domain 使用，用于约束对象模型、输出契约、审计规则与权重外置规则，不作为内容对象的 primary domain。[file:1][file:2]

这符合规则文件关于“不要把所有内容都放进 neuro_kb”的要求。[file:2]

## Subdomains

本批主子域可划分为：

- `social_support`：对应同伴行动、家庭支持、亲密朋友影响、网络减肥社群、浸染与主动分享。[file:3]
- `pharmacotherapy`：对应减肥保健品、正规减肥药、奥利司他、二甲双胍、药物适应证与长期管理。[file:4]

## Secondary Domains

可识别但不设为主域的 secondary domains 包括：

- `behavior_change`：因为两份课程都强调行为改变，而不仅是知识陈述。[file:3][file:4]
- `health_decision_making`：药物使用部分涉及权衡利弊与适应证判断，但当前仍服务于体重管理主域。[file:4]

## Domain Decision

最终 domain_id 采用 `weight_management`，domain_name 采用“科学减肥知识库”，并以 `social_support` 与 `pharmacotherapy` 作为当前批次的核心子域。[file:2][file:3][file:4]
