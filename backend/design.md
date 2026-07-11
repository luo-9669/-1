# AI 创作页 Design.md

Source: internal design reference

This file is the product UI design source for this project. Future pages and generated Vue/Vite packages should follow these rules before adding local decoration.

## Overview / 品牌定位

AI 创作页是一个 AI 设计创作入口：用户进入页面后应立即看到“今天想要创作什么？”的任务中心、Agent 输入区、快捷场景入口和模板内容流。视觉性格是轻、干净、工具化，不做厚重后台，也不做强营销首页。

Core principles:
- Keep the first screen focused on creation, not documentation or marketing.
- Use a white canvas with very light gray navigation surfaces.
- Prioritize quick actions: prompt input, scene chips, category shortcuts, template cards.
- Visual hierarchy comes from spacing, card size, typography weight, and small accent color, not heavy borders.
- Screens should feel spacious but operational: users can scan, pick a scene, and continue.

## Colors / 色彩体系

| Token | Value | Usage |
| --- | --- | --- |
| Ink | `#222529` | Primary text, active nav, strong headings |
| Text Secondary | `#4c535c` | Secondary labels, sidebar login, metadata |
| Text Muted | `#7f8792` | "More", helper copy, disabled copy |
| Text Disabled | `#9da3ac` | Empty-state text |
| Canvas | `#ffffff` | Main content background |
| Shell | `#f6f7f9` | Left sidebar and quiet app chrome |
| Soft Surface | `#f7f8fa` | Template placeholders and subtle panels |
| Border | `#e8eaec` | Hairline dividers and low-emphasis boundaries |
| Primary | `#222529` | Highest-emphasis action such as login or primary submit |
| Accent Cyan | `#69e1f5` | Creative highlight, selected word, notification accent |
| Accent Blue | `#2578ff` | Logo-like gradient start and focused accents |
| Accent Orange | `#ff7a1a` | E-commerce/tool icon accent only |

Rules:
- Main UI must stay mostly white. Do not flood the page with blue or purple surfaces.
- Use `Ink` for primary buttons instead of saturated blue.
- Use cyan as a small highlight: one word in a heading, a notice strip, selected state, or focus glow.
- Borders should usually be `#e8eaec` or transparent; avoid dark container outlines.
- Empty and disabled states use muted text and airy space, not warning colors.

## Typography / 字体与排版

| Role | Rule |
| --- | --- |
| Font Family | `"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "WenQuanYi Micro Hei", Arial, sans-serif` |
| Base Text | `14px / 21px / 400` |
| Micro Label | `11-12px / 16-18px / 500-600` |
| Section Title | `20-22px / 28-32px / 700` |
| Hero Question | `34-40px / 48px / 800` |
| Button Text | `14px / 21px / 400-600` |

Rules:
- Letter spacing is `0`; do not use compressed display text.
- Section titles are compact and left-aligned in content sections.
- Hero-scale text is reserved for the main creation prompt only.
- Body copy should be short. Operational labels beat long explanatory text.

## Layout / 布局与间距

| Area | Rule |
| --- | --- |
| Top Bar | `72px` tall, sticky, white/transparent, content aligned center |
| Left Sidebar | `72px` wide, sticky under top bar, background `Shell` |
| Main Offset | Content starts after the `72px` sidebar; page remains white |
| First Screen Center | Primary creation module centered with max width around `800px` |
| Content Sections | Full-width bands, inner padding `20px 24px`, gap `16px` |
| Template Grid | Cards around `214px x 324px`; horizontal scroll or responsive wrapping |
| Base Grid | 4px grid; common spacing `8, 12, 16, 20, 24, 32, 48, 72` |

Rules:
- Do not put page sections inside large floating cards.
- Use full-width white sections with constrained inner content.
- Side navigation stays narrow and icon-first; labels are small.
- Template/content lists should be scannable and dense, not oversized editorial cards.
- Mobile collapses the sidebar into a horizontal rail and keeps the creation input first.

## Elevation & Depth / 阴影与层级

| Layer | Rule |
| --- | --- |
| App Chrome | No shadow or a very light divider |
| Prompt Composer | Soft shadow: `0 24px 72px rgba(34, 37, 41, 0.08)` |
| Floating Notice | Soft shadow: `0 24px 60px rgba(34, 37, 41, 0.12)` |
| Template Cards | No default shadow; lift only on hover |
| Modals/Popovers | White surface, `12-16px` radius, soft shadow |

Rules:
- Shadows are for floating elements, not every panel.
- Template cards rely on size, image, and title strip rather than container chrome.
- Avoid stacked card-inside-card layouts.

## Shapes / 圆角体系

| Token | Value | Usage |
| --- | --- | --- |
| Radius Small | `6px` | Small buttons, sidebar login |
| Radius Base | `8px` | Buttons, inputs, thumbnails |
| Radius Medium | `12px` | Prompt composer, popovers, panels |
| Radius Large | `16px` | Promotional floating cards |
| Radius Pill | `99px / 999px` | Segmented controls, scene chips |

Rules:
- Use pills for quick category choices and scene chips.
- Use `8px` for practical controls.
- Use `12px` only when a surface is intentionally soft or floating.

## Components / 组件规范

### App Shell / 应用外壳

| Property | Rule |
| --- | --- |
| Sidebar Width | `72px` desktop |
| Sidebar Background | `#f6f7f9` |
| Top Bar Height | `72px` |
| Active Nav | Ink icon/text, no heavy block fill |

Rules:
- Sidebar items are icon-first, label second, vertically stacked.
- Keep labels short: 创作、发现、我的、创建、登录.
- Do not use a dark enterprise sidebar for this product style.

### Primary Button / 主按钮

| Property | Rule |
| --- | --- |
| Height | `32-40px` depending on context |
| Radius | `8px` |
| Background | `#222529` |
| Text | White, `14px / 600` |
| Padding | `0 12-16px` |

States:
- Hover: background `#111315`.
- Disabled: muted text, light surface, no black fill.
- Loading: preserve width and height.

Misuse:
- Do not use bright blue primary buttons unless the action is logo/accent-specific.
- Do not make destructive actions black.

### Segmented Control / 分段切换

| Property | Rule |
| --- | --- |
| Height | `32-36px` |
| Radius | `99px` |
| Container | `#f1f2f4` |
| Active Item | White fill, subtle shadow, `600` text |
| Padding | `12px 32px` on desktop |

Behavior:
- Three or fewer options work best.
- Active state should feel selected but quiet.
- Mobile may reduce horizontal padding.

### Prompt Composer / 创作输入区

| Property | Rule |
| --- | --- |
| Width | `min(800px, calc(100vw - 48px))` |
| Min Height | `144-172px` |
| Radius | `12px` |
| Background | White |
| Shadow | Soft, broad |
| Placeholder | Muted text, `14px` |

Rules:
- The upload tile or add affordance appears on the left.
- The mode indicator sits at the bottom left.
- The submit control can be compact and icon-like on the right.
- Do not replace the composer with a standard single-line search box.

### Scene Chip / 场景胶囊

| Property | Rule |
| --- | --- |
| Height | `46px` |
| Width | around `185px` |
| Radius | `999px` |
| Background | White |
| Border | `1px solid #f6f7f9` |
| Layout | Optional thumbnail/icon at left, label center, arrow at right |

States:
- Hover: border `#e8eaec`, slight lift.
- Selected: ink text, subtle cyan tint only if needed.

Misuse:
- Do not make chips look like heavy form buttons.

### Category Shortcut / 工具分类入口

| Property | Rule |
| --- | --- |
| Icon Box | `44px x 44px`, radius `12px`, white with light border |
| Label | `14px`, centered below icon |
| Spacing | `24-36px` between items |

Rules:
- Use familiar icons where available.
- Keep icon style line-based and monochrome with occasional accent.

### Template Card / 模板卡片

| Property | Rule |
| --- | --- |
| Size | `214px x 324px` desktop baseline |
| Radius | `8px` |
| Image | Fills card body |
| Title Strip | Ink background with white text at top |
| Gap | `16px` between cards |

Behavior:
- Hover can reveal actions, but default state should be image-forward.
- Cards should not become generic white cards with text descriptions.
- Maintain aspect ratio on responsive layouts.

### Section Header / 内容区标题

| Property | Rule |
| --- | --- |
| Title | `20-22px / 700`, Ink |
| Subtitle | `14px`, muted |
| More Link | Right aligned, muted, `14px` |

Rules:
- Header is aligned to the template grid, not centered.
- Use “更多” for list expansion when relevant.

### Empty State / 空状态

| Property | Rule |
| --- | --- |
| Height | around `129px` inside content section |
| Text | `#9da3ac`, `14px` |
| Background | Transparent or very light |

Rules:
- Empty state should be quiet and recoverable.
- Include a clear next action when the workflow is user-owned.

## Motion / 动效原则

- Use `160-220ms ease` for hover, focus, tab, and chip transitions.
- Motion should clarify affordance: lift, border change, soft glow.
- Avoid continuous decorative animation in work surfaces.
- Respect reduced motion; disable nonessential transforms under `prefers-reduced-motion`.

## Visual Principles / 视觉原则

- The product should feel like a creative operating surface: light, fast, and direct.
- First viewport must reveal the creation center and the beginning of the template workflow.
- Use real page content patterns: prompt composer, scene chips, tool shortcuts, template rows.
- Avoid generic SaaS dashboard visuals: dark sidebars, metric cards, oversized status cards.
- Avoid decorative gradient blobs or abstract hero illustrations.

## Do's and Don'ts / 必须做与绝对禁止

Do:
- Use a `72px` narrow sidebar and `72px` top rhythm.
- Keep primary action black/ink and accents cyan.
- Use pill controls for modes and scene shortcuts.
- Render template cards with fixed aspect ratios.
- Keep panels flat and white with light borders.

Don't:
- Do not use dark navy sidebars as the default shell.
- Do not use blue as the default primary button across the app.
- Do not put every section into a floating card.
- Do not turn the homepage into a marketing hero.
- Do not use screenshot-only output as final generated code.

## Page Patterns / 页面模式

### Creation Home / 创作首页

Intent: start a design or AI generation task quickly.

Required hierarchy:
- Top bar with compact account action.
- Left icon rail.
- Center hero question with one highlighted word.
- Segmented mode control.
- Prompt composer.
- Scene chips.
- Tool shortcuts.
- Template/content workflow rows.

Primary action: submit prompt or choose a scene chip.

Recovery:
- If no templates load, show a quiet empty state and keep creation actions available.

### Template Workflow Row / 模板工作流行

Intent: let users scan ready-to-use design workflows.

Required components:
- Section header and subtitle.
- “更多” link at right.
- Horizontal card list or responsive grid.
- Template cards with image-forward preview and title strip.

### Project Tool Page / 项目工具页

Intent: adapt this visual language to internal tools such as 流程通.

Required components:
- Keep narrow light sidebar.
- Use topbar as current task context.
- Use full-width unframed sections where possible.
- Use flat panels only for actual tools, forms, repeated items, and previews.
- Use chips, segmented controls, and compact action buttons before large dashboard cards.

## Conflict Priority / 冲突优先级

| Priority | Rule |
| --- | --- |
| 1 | Accessibility, readable text, and stable responsive layout |
| 2 | Creation-first product identity |
| 3 | Observed AI creation page patterns |
| 4 | Existing project functionality |
| 5 | Decorative preferences |

When a rule conflicts with usability, keep usability. When it conflicts with old project styling, follow this design.md.

## Quality Checklist / 生成前自查

- First screen starts with a creation/workflow surface, not a marketing page.
- Sidebar is light, narrow, and icon-first.
- Primary buttons use Ink, not default blue.
- Segment controls and scene options are pill-shaped.
- Template cards preserve image-forward aspect ratios.
- Main sections are not nested inside decorative cards.
- Text fits on mobile and desktop without overlap.
- Empty states are quiet and do not block primary actions.
- Generated packages include this design.md or an equivalent rule source.
