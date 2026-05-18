# 类人脑知识库 Skill 规范（v1）

> 由两部分组成：  
> A. 写入规则 + 不存什么 + 联网触发策略（你刚确认的版本）  
> B. 专家库三层结构 + 更新单元 + 权重更新 + 评分接口（本次新增）

---

## A. 写入规则 + 不存什么 + 联网触发策略（v1）

> 适用于：以 Fact / View / Episode / Procedure / Task 五类对象（Evidence 已并入 Fact/View）为基础的个人/专家知识库；作为后续 skill 的“写入与检索决策层”。

### A.1 共识前提

1. **对象类型**：
   - Fact：经过你消化后的事实/结论，需带时间戳（发生时间或认知时间）。
   - View：你对某问题的判断、解释、立场（包含 subtype=hypothesis 的假设类观点）。
   - Episode：一次具体经历、项目、对话、实验等，有明确时间与情境。
   - Procedure：可复用的方法、流程、操作步骤。
   - Task：当前要解决的任务/问题，包含 goal 与 constraints。
   - Evidence 不再单列对象类型，证据信息融入 Fact/View 的 content 与 source 中，必要时通过 Episode 或原始数据表追溯。

2. **存储视角**：
   - 不追求“万物入库”，而是只存“未来高价值、难以在网上复现、且与你的思考结构强相关”的内容。
   - 联网检索是知识库的常规补充通道，而不是失败兜底。

3. **实现边界**：
   - 不在对象 schema 中增加额外字段（例如 evidence_snippets 等），只假定每类对象已有最小字段：id / type / content / time / context / source / confidence 等。
   - 权重、使用日志等由外部权重表与日志系统维护，不写入知识对象本体。

### A.2 写入规则：什么应该进入知识库

写入原则：**只写“有你参与加工、未来可复用、网上不易替代”的内容**。

#### A.2.1 Fact（事实/结论）

满足以下条件之一，写入为 Fact：

1. **你已对多源信息做过整合/比对**，形成自己的结论版本。
2. **该结论在你后续决策/方案中会反复作为前提使用**。
3. **外部口径分歧较大，你已经选定了自己的基准口径**。
4. **该知识较难可靠检索或重建**（资料分散、需付费、需特殊访问等）。
5. **是你自己推导出来的中间结论**，日后可能支撑多个 View/Procedure。

补充要求：

- Fact 必须记录时间戳（发生时间或你形成该结论的时间），以便后续判断时效性与版本演化。
- 对于“纯百科式、随查随得”的事实，如无你的特殊加工，一般**不写入**。

#### A.2.2 View（观点/假设）

满足以下条件之一，写入为 View：

1. **是你经过思考形成的判断/立场/框架**，而非简单引用他人观点。
2. **未来会用于指导决策、课程设计、模型设计、方法选择**。
3. **存在明显替代方案/争议，需要在库中呈现不同观点并管理冲突**。
4. **是假设（hypothesis），未来需要用新事实去验证/推翻**。

说明：

- 如果一句话同时包含事实与观点，应拆为一个 Fact + 一个 View，并用“supports/derived_from”等关系相连。
- 外部作者的观点，只有当你采纳或用于对比时，才写入为 View；否则保留在原文或引用层，不进核心库。

#### A.2.3 Episode（经验/案例）

满足以下条件之一，写入为 Episode：

1. **是你参与或高度关注的一次关键实践**：项目、直播、课程、实验、重大决策等。
2. **未来可能多次被引用为“源案例”或“反例警示”**。
3. **在该 Episode 中，你学到了新的 View/Procedure，或推翻了原有认识**。

Episode 的价值在于：为 Fact/View/Procedure 提供情境索引（where/when/how learned），不是所有日常琐事都需要写入。

#### A.2.4 Procedure（方法/流程）

满足以下条件之一，写入为 Procedure：

1. **你已经在实际任务中使用过至少一遍，且效果可接受**。
2. **未来可能在多个 Task/项目中复用**。
3. **你希望在课程、直播或咨询中复盘和教授**。

不建议把“还没实践过的想法”直接写成 Procedure，可以先作为 View（hypothesis），待验证后再升级为 Procedure。

#### A.2.5 Task（任务）

写入 Task 有两个用途：

1. 作为**检索入口**：记录你曾解决过的重要问题，以便未来复用方案。  
2. 作为**知识组织单元**：挂接相关的 Fact / View / Episode / Procedure。

满足以下条件之一，写入为 Task：

1. 是一个复杂、会反复出现的任务类型（如“构建类脑知识库 skill”“为 9–15 岁设计学习路径”）。
2. 涉及多轮对话、多文献/项目整合，值得在库中留下完整问题–解法路径。

### A.3 什么不必写入知识库

#### A.3.1 易于网上检索、且与你无独特加工的内容

通常**不写入**本地知识库，只在需要时临时联网查询：

1. 公共百科式事实：如一般公司/人物的基本简介、标准定义、常见公式等。
2. 可通过权威数据库随查随得的统计数据，而你不打算长期维护本地版本。
3. 与你项目/决策关系很弱的背景新闻、评论性文章。
4. 你暂时不打算采用的他人观点（只作为参考阅读）。

#### A.3.2 大量原始数据表

建议**不全部导入**，而是：只在本地记录“使用过的指标/结果 + 引用路径”：

1. 可以在官网/数据库稳定下载的公共数据表。
2. 你仅需要其中一两个汇总指标，而不需要反复做深度分析。

例外：

- 对于“很难再找到、口径不统一、你已花成本清洗过”的数据表，可以作为“原始数据资产”保存在本地，并在 Fact/View 中引用其路径。

#### A.3.3 低价值、低置信的内容

一般作为临时上下文，不写入长期库：

1. 你尚未判断可信度的零散信息。
2. 出处不明、无法验证的说法。
3. 纯情绪性/吐槽式记录，与后续决策无关。

### A.4 联网触发策略：何时需要查网

联网不是失败兜底，而是“**在特定条件下的正常步骤**”。

#### A.4.1 默认流程

1. 接收问题或 Task。  
2. 做问题解析与子问题拆分（问题定义级别的 Task）。  
3. 针对每个子问题，先在本地知识库检索：
   - 匹配的 Task / Procedure（是否有类似任务/方法）。
   - 相关的 Fact / View / Episode（是否有历史经验和结论）。

#### A.4.2 触发联网的条件

对某个子问题，满足以下任一条件，即可触发联网检索：

1. **本地命中严重不足**：
   - 相关 Fact+View 总数低于阈值（如 < 2 条）。
   - 没有任何匹配的 Procedure 或 Episode 可参考。

2. **问题具有明显时效性**：
   - 询问最新政策、最新研究进展、最新产品或市场数据。
   - 本地 Fact 对应的时间戳明显过旧（如 > 2–3 年）。

3. **需要多源对比或验证**：
   - 子问题本质是“查证/对比”（例如“是否有研究反对某观点”）。
   - 本地 View/Fact 存在明显冲突，需要外部证据帮助判断。

4. **领域明显超出当前专家库覆盖范围**：
   - 问题涉及尚未建立专家库的全新领域。

#### A.4.3 联网后的处理方式

1. 联网结果**优先用于当前回答**，不自动写入长期知识库。  
2. 只有当某条外部信息符合写入规则（A.2），才会：
   - 被提炼为新的 Fact/View/Procedure/Episode；
   - 在本地库中建立相应关系链条。
3. 对于“多口径数据”，可在本地用一个 Fact 记录“你选定的口径 + 时间戳 + 来源”。

### A.5 写入与联网决策伪代码

```pseudo
function handle_new_information(info, context_task):
    parsed_units = split_into_units(info)  # 拆成候选 Fact/View/Episode/Procedure
    for unit in parsed_units:
        if not should_store(unit):
            continue
        obj_type = classify_type(unit)  # Fact/View/Episode/Procedure/Task
        obj = build_object(obj_type, unit)
        save_to_kb(obj)
        link_to_task(obj, context_task)

function should_store(unit):
    if is_trivial_web_fact(unit) and not personalized(unit):
        return False
    if low_confidence(unit) and no_clear_future_use(unit):
        return False
    if is_massive_raw_table(unit) and easily_redownloadable(unit):
        return False
    return True

function answer_question(question):
    task = define_task(question)
    sub_tasks = decompose(task)
    local_context = []
    external_context = []

    for sub in sub_tasks:
        local_hits = search_local_kb(sub)
        if is_insufficient(local_hits) or is_time_sensitive(sub) or needs_verification(sub, local_hits):
            web_results = search_web(sub)
            external_context += web_results
        local_context += local_hits

    answer = llm_generate_answer(question, local_context, external_context)
    return answer
```

---

## B. 专家库三层结构 + 更新单元 + 权重更新 + 评分接口

> 这一部分定义“知识库怎么分专家域、怎么更新、回答质量如何影响权重”；和 A 部分一起构成完整 skill。

### B.1 专家库三层结构

整体采用“三层专家库 + 交叉映射”结构：

1. **L1：专家域级知识库（Domain KB）**  
   - 例如：类脑知识库设计、AI 教育 9–15 岁、战略方法库、行业研究库等。  
   - 承载该领域的核心 Fact / View / Procedure，以及顶层 Task。  
   - 每个 L1 专家库有自己的域标识，如 `domain_id = "neuro_kb"`。

2. **L2：子域/专题级知识库（Sub-domain KB）**  
   - 属于某一 L1 域之下，如：编码层、存储层、检索流程、权重机制……  
   - 是主要的工作与更新单元：新增知识通常落在某个 L2 子域中。  
   - 每条对象记录包含 `primary_domain` + `subdomain` 字段。

3. **L3：任务/项目级视图（Task/Project View）**  
   - 典型如：某次 skill 设计、某课程大纲、某企业研究项目。  
   - 以 Task 为中心，挂接与之相关的 Fact/View/Episode/Procedure，形成局部“解决方案图”。  
   - L3 视图主要通过 Task 对象与 L1/L2 对象建立关系，不必复制节点。

**交叉映射层**：

- 对于跨域知识，通过字段：
  - `primary_domain`: 主域。  
  - `secondary_domains`: 次域（数组）。
- 对于跨域关系（某 Procedure 同时适用于两个域），通过关系边连接不同域的节点。

### B.2 更新单元与迭代策略

更新策略遵循“**常态以 L2 为单元，大改才触及 L1**”的原则：

1. **常规新增/修订**（默认）：
   - 新知识先归入某个 L2 子域，并在该域内部建立关系。  
   - 如影响多个子域，再在相应 L2 中做少量桥接。  
   - L1 只在需要新增“顶层总结结论/方法论”时才更新。

2. **重大结构调整**（偶尔）：
   - 当你推翻或大幅调整某个大 View / Procedure（如整个编码层设计），需要：
     - 在 L1 域中标记旧 View 为 `deprecated` 或 `revised`；
     - 创建新的 View/Procedure 节点；
     - 在相关 L2 子域中同步更新引用关系；
     - 在 L3 Task 视图中，按需切换引用路径。

3. **任务级视图更新**：
   - L3 多为 Episode + Task 的组合视图，可按项目自然增长，无需全局重构。  
   - 当 L1/L2 发生重大调整时，L3 视图只需要在“未来继续使用时”按需更新（lazy update），而不是一次性批量改写。

### B.3 权重体系：节点/边权重外置

权重层独立于知识对象，采用两张表：

1. **NodeWeights**：

   ```json
   {
     "node_id": "fact_2025_001",
     "base_weight": 0.72,
     "activation_count": 10,
     "reuse_count": 6,
     "task_scores": {
       "neuro_kb:编码层设计": 0.85,
       "neuro_kb:权重机制": 0.40
     }
   }
   ```

2. **EdgeWeights**：

   ```json
   {
     "edge_id": "edge_0001",
     "source_id": "fact_2025_001",
     "target_id": "view_2026_003",
     "relation_type": "supports",
     "edge_weight": 0.70,
     "co_activation_count": 5,
     "successful_path_count": 4
   }
   ```

特征：

- **不在知识对象本体内嵌权重**，所有动态行为记录都在外部权重表中维护。  
- 不强制时间衰减；后续如有需要，可在批量更新脚本里增加衰减因子。  
- `task_scores` 用于记录节点在不同任务/子域下的专用权重，避免一个域内的高频路径干扰其他域。

### B.4 评分接口：回答质量如何影响权重

目标：

- 让“回答质量”成为 Hebbian 强化的门控信号——**只有高质量回答参与的路径才被显著强化**。

#### B.4.1 评分维度

每次问答结束后，可引入一个简单评分接口，评分范围例如 0–5：

- 0–1：明显错误或无用的回答。  
- 2：部分相关但价值有限。  
- 3：基本正确，可接受。  
- 4：较好，有启发。  
- 5：非常好，可作为模板复用。

评分可以由你手动给、或通过后续 UI/表单收集。

#### B.4.2 权重更新规则（批量执行）

1. **收集日志**：
   - 对每次问答，记录：
     - `question_id` / `task_id`
     - 使用到的节点列表 `used_node_ids`
     - 使用到的边列表 `used_edge_ids`
     - 用户评分 `score`

2. **批处理脚本更新（伪代码）**：

```pseudo
function batch_update_weights(logs):
    for log in logs:
        q_score = log.score  # 0-5
        if q_score <= 1:
            # 非常差：只记录激活，不做正向强化
            for nid in log.used_node_ids:
                NodeWeights[nid].activation_count += 1
            for eid in log.used_edge_ids:
                EdgeWeights[eid].co_activation_count += 1
            continue

        # 转换为 [0,1] 区间的质量因子
        quality = (q_score - 1) / 4.0  # 评分>=2 才有正向强化

        for nid in log.used_node_ids:
            NodeWeights[nid].activation_count += 1
            NodeWeights[nid].reuse_count += 1
            NodeWeights[nid].base_weight += alpha_node * quality

        for eid in log.used_edge_ids:
            EdgeWeights[eid].co_activation_count += 1
            EdgeWeights[eid].successful_path_count += 1
            EdgeWeights[eid].edge_weight += alpha_edge * quality
```

3. **按任务/子域更新 task_scores**：

- 在更新节点权重时，可根据当前 Task 或子域信息，同时更新 `task_scores[domain:subdomain]`，例如：

```pseudo
NodeWeights[nid].task_scores["neuro_kb:编码层设计"] += beta * quality
```

这样可以形成“**域内专家路径**”：在特定子域里常用的节点和链路，在该子域下权重更高，但在其他域不必同步升高。

### B.5 专家库更新流程（结合 A 部分）

综合 A、B 两部分，专家库的日常运行可以抽象为：

1. **写入阶段**：
   - 新材料 → 按 A.2 拆成 Fact/View/Episode/Procedure/Task。  
   - 按领域与子域分配 `primary_domain` + `subdomain`。  
   - 按写入规则决定是否入库，不入库的只作为临时上下文或外链。  
   - 建立基本关系边（supports/derived_from/learned_from/applies_to 等）。

2. **检索与回答阶段**：
   - 用户问题 → 定义 Task → 拆分子 Task。  
   - 在对应域/子域中检索相关对象，一跳/多跳扩展。  
   - 如本地不足或时效性强，按 A.4 触发联网检索。  
   - 本地 + 联网上下文交由 LLM 生成回答。  
   - 记录使用节点/边与问题评分。

3. **批量权重更新阶段**（周期性执行）：
   - 读取问答日志。  
   - 按 B.4 中规则更新 NodeWeights 与 EdgeWeights。  
   - 可选：对长期未用且权重低的节点/边做清理标记，辅助你后续人工整理。

4. **专家库结构更新阶段**（较低频率）：
   - 当某个 L2 子域知识结构明显变化时，调整其内部 View/Procedure，并在 L1 域更新顶层总结结论。  
   - 对重要 L3 Task 视图，在下次使用前按需更新引用路径。

---

本文件作为“类人脑知识库 skill 规范 v1”，可直接用于：

- 作为 Perplexity/GPT 的 system prompt / skill 描述，指导模型在写入、检索、联网与权重更新时遵循一致规则；
- 作为你后续实现 Obsidian + 外部权重表 + 批处理脚本时的设计依据。
