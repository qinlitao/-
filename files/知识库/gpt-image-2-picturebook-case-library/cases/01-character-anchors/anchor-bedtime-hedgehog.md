# PB-ANCHOR-001 睡前小刺猬角色锚点

- case_id: PB-ANCHOR-001
- use_case: 为睡前绘本建立主角锚点图，后续所有页面复用同一角色。
- tags: 角色锚点, 睡前故事, 3-8岁, 水彩, 轻奇幻

## prompt
Create the reusable main character for a children’s picture book.

Character:
A 7-year-old little hedgehog girl named Mili, round face, warm brown eyes, short soft chestnut spines, small cream-colored muzzle, tiny button nose, cheerful but gentle expression.
She always wears a mustard-yellow raincoat, teal rain boots, and carries a small acorn-shaped satchel.

Purpose:
This image will serve as the character anchor for a multi-page children’s picture book. The design must be stable and easy to reproduce across future pages.

Style:
High-quality children’s book illustration, soft watercolor and gouache texture, gentle brush edges, warm storybook palette, clean silhouette, readable for ages 3-8, friendly proportions, expressive face, slightly oversized head, charming but not babyish.

Composition:
Full body visible, standing naturally, plain light forest background, enough negative space around the character, centered composition.

Constraints:
Keep the outfit simple and memorable.
Do not add extra accessories.
Do not add text.
Do not redesign the character with anime, 3D toy, or hyper-realistic adult proportions.
No watermark.

## why_it_works
- 先定义 Purpose，告诉模型这是多页复用角色，不是一次性插图。
- 把外观、服装、比例和气质写成稳定锚点，后续更容易保持一致。
- 采用 plain background + centered composition，方便后续当作参考图或编辑基底。

## replaceable_variables
- hedgehog girl -> rabbit boy / fox child / little dinosaur
- mustard-yellow raincoat -> signature costume
- forest background -> classroom / town / moon base

## fix_lines
- Keep exactly the same face shape, outfit, and body proportions.
- Do not redesign the character.
- Preserve the same storybook watercolor style.
