# Decisiones (ADRs)

## ADR-0001 — Modelo de trabajo con IA
**Estado:** Vigente  
- Fuente única de verdad: HEAD del repo + `/docs/*.md`.
- Cambios asistidos por IA siempre en **parches (git diff)**.
- Cada bug cerrado deja **test de regresión**.
- Ciclo: **Plan → Diff → Test → Merge**. Ticket = sesión nueva.

## ADR-0002 — Política de migraciones TypeORM
- Una migración por cambio funcional; idempotente; sin data loss silencioso.
- Convención: `YYYYMMDDHHmm-<scope>.ts`.
- Prohibido modificar migraciones ya aplicadas; crear nuevas “fix” si es necesario.
- `npm run migration:generate` solo tras aprobar el diseño de datos.

## ADR-0003 — Versionado de flujos n8n
- Los flujos se exportan como JSON y viven en `/flows/<name>.json`.
- Todo cambio de flujo va en PR con descripción y diff semántico (si aplica).
- Se mantiene `flows/README.md` con mapping “flujo → servicio/endpoint”.

## ADR-0004 — Contratos BFF ↔ Connector
- OpenAPI/contratos versionados en `/contracts/<service>/vX.yaml`.
- El BFF nunca rompe compatibilidad sin bump de versión y plan de deprecación.
- Test de contrato en CI para BFF y Connector.

## ADR-0005 — Electron: vigilancia y configuración
- `chokidar` solo observa la carpeta configurada en `electron-store`.
- Cambios de configuración requieren validación y prueba de permisos.
- No bloquear el hilo principal con IO; usar procesos/worker si es pesado.
