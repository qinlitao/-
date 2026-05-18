# PB-RULE-001 主角一致性规则

- case_id: PB-RULE-001
- use_case: 叠加到多页绘本 prompt 中，防止主角漂移。
- tags: 一致性规则, 主角一致性, 多页

## prompt
Character consistency rules for all pages:
Keep the exact same face shape, eye color, body proportions, hairstyle or fur pattern, signature outfit, shoes, and recurring prop on every page.
The character may change pose and expression, but must remain immediately recognizable as the same child.
Do not redesign the age, costume style, species proportions, or illustration style.

## why_it_works
- 这是最适合重复叠加的规则型 prompt。
- 明确“可变”和“不可变”，比笼统说保持一致更稳定。

## replaceable_variables
- signature outfit
- recurring prop
- species proportions

## fix_lines
- Keep the same child identity on every page.
- Do not redesign costume, age, or proportions.
