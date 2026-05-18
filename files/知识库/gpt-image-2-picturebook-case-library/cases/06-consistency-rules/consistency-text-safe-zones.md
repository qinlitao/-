# PB-RULE-004 文本安全区与留白规则

- case_id: PB-RULE-004
- use_case: 为后期排版预留文字区域，避免插图淹没文本。
- tags: 一致性规则, 文本留白, 版式

## prompt
For all pages, keep clear text-safe zones.
Reserve at least one clean area with low visual detail where text can be added later, either in the sky, floor, margin, or a simple shape.
Do not cover this area with dense decorations or tiny objects.
Maintain similar text-safe placement across the book so the layout feels consistent.

## why_it_works
- 插画先考虑 text-safe zones 能大大减少后期排版痛苦。

## replaceable_variables
- sky / floor / margin -> side banner / bottom band

## fix_lines
- Keep one area per page simple and low-detail for future text.
- Avoid filling every corner with complex details.
