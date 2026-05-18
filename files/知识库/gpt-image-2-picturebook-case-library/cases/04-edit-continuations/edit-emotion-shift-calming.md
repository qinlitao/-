# PB-EDIT-003 情绪转折：从生气到冷静

- case_id: PB-EDIT-003
- use_case: 在已有争执场景基础上，生成情绪缓和的下一页。
- tags: 连续编辑, 情绪转折, 社交情绪

## prompt
Edit the previous argument scene illustration to show the moment of calming down.

Change only:
- The children’s faces soften from angry to thoughtful.
- Their bodies turn slightly toward each other instead of away.
- The lighting becomes a little warmer and softer.

Keep exactly the same:
- Characters’ identities, outfits, and proportions.
- Room layout and props on the table.
- Overall picture book style and color palette.

Do not add new characters.
Do not introduce new dramatic elements.
No text, no watermark.

## why_it_works
- 专门写 face soften 和 body turn，能让模型把情绪变化画在表情和姿态上，而不是凭空加剧情。

## replaceable_variables
- argument scene -> crying scene / worrying scene
- warmer and softer -> cooler and quieter

## fix_lines
- Change only facial expressions and body direction.
- Keep the same setting, style, and characters.
