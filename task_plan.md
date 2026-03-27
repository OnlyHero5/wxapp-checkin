# Task Plan: wxapp-checkin Web 前端组件化审查

## Goal
对 `wxapp-checkin/web` 当前前端代码进行全面审查，识别手写 HTML/CSS/JavaScript 过多、组件库能力未复用、伪组件化以及超长文件导致可维护性下降的问题，并给出基于组件库文档的明确结论。

## Current Phase
Phase 5

## Phases

### Phase 1: 结构与依赖摸底
- [x] 确认用户审查目标与限制
- [x] 校准真实前端路径与当前分支
- [x] 识别组件库及主要页面结构
- **Status:** complete

### Phase 2: 代码规模与热点定位
- [ ] 统计超长文件与高复杂度热点
- [ ] 定位大段手写结构、样式和交互实现
- [ ] 记录候选审查文件
- **Status:** complete

### Phase 3: 组件库能力对照
- [ ] 联网查阅组件库官方文档
- [ ] 对照当前实现识别可替换的手写部分
- [ ] 识别“套组件库壳但本质仍手写”的实现
- **Status:** complete

### Phase 4: 审查结论整理
- [ ] 按严重度整理 findings
- [ ] 给出文件级定位与整改方向
- [ ] 说明假设、遗漏风险与验证范围
- **Status:** complete

### Phase 5: 交付
- [x] 复核输出与引用路径
- [x] 向用户提交审查报告
- **Status:** complete

## Key Questions
1. `wxapp-checkin/web` 当前实际使用了哪些 TDesign Mobile React 组件能力？
2. 哪些页面或组件存在“组件库可替代但仍手写”的实现？
3. 哪些文件长度或职责已经超过合理维护边界？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 以前端真实目录 `wxapp-checkin/web` 为审查对象 | 仓库指南中的 `frontend/` 已与当前结构不一致，实际前端代码在 `web/` |
| 先做规模扫描，再做文件深读 | 先找到高风险热点，避免平均分配精力导致审查不聚焦 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| 仓库指南中的 `wxapp-checkin/frontend` 路径不存在 | 1 | 改为审查真实目录 `wxapp-checkin/web`，并在结论中注明 |

## Notes
- 审查仅针对 `wxapp-checkin/web`
- 不修改业务代码，只输出审查结论
