# Review: US-010-redesign-ui

## Findings

1. **Medium**: В слайсе 4 закладывается `flex row` для трёх карточек статистики, а мобильная адаптация только в слайсе 5. Если слайсы мержатся по отдельности, будет временная регрессия на узких экранах.  
   References: `docs/plans/US-010-redesign-ui.md:74`, `docs/plans/US-010-redesign-ui.md:83`

2. **Medium**: Верификация покрывает только happy-path, но не покрывает критичные режимы, завязанные на текущий JS: `Dev Mode`, сохранение настроек, и возврат значений после перезагрузки. Это может сломаться при редизайне формы setup без явного обнаружения.  
   References: `docs/plans/US-010-redesign-ui.md:89`, `src/web/js/app.js:80`, `src/web/js/app.js:85`, `src/web/js/app.js:91`

3. **Low**: В ограничениях указан `app.js`, но фактический путь в проекте `src/web/js/app.js`; это мелкая, но практическая неоднозначность для исполнителя.  
   References: `docs/plans/US-010-redesign-ui.md:12`, `src/web/index.html:81`

4. **Low**: Для анимаций (пульсация заголовка) нет требования на `prefers-reduced-motion`; это потенциальный UX/accessibility риск.  
   Reference: `docs/plans/US-010-redesign-ui.md:76`

## Open Questions / Assumptions

1. Слайсы предполагаются к мержу по одному PR или одним общим PR в конце?
2. Нужен ли минимум accessibility-критериев (контраст, reduced motion, focus-visible) как DoD, а не только “выглядит красиво”?
