---
name: "Tarea"
about: "Trabajo acotado con Plan → Diff → Test → Merge"
title: ""
labels: ["tarea"]
assignees: []
---

## Objetivo
(qué necesito y por qué)

## Alcance
- TOCAR: (rutas/archivos permitidos)
- NO TOCAR: (lo que queda fuera)

## Pruebas
- (endpoint/test e2e/CI que debe pasar + cómo validarlo)

## Plan (borrador)
- (pasos en viñetas, 5–8 líneas)

## Entregables
1) `git diff` unificado aplicable (solo archivos del alcance)
2) Tests/ajustes de CI necesarios
3) Notas de prueba (comandos + resultado esperado)

## Criterios de aceptación
- [ ] CI BFF en verde (lint/types/e2e)
- [ ] LOG.md actualizado (+ ADR si procede)
- [ ] Sin romper contratos/seguridad

## Contexto
- LOG: enlace a `docs/LOG.md` (sección relevante)
- DECISIONES: enlace a `docs/DECISIONS.md` (si aplica)
- Charter: `docs/PRODUCT_CHARTER.md`
