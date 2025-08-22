# PROMPT — Cambio de contrato BFF ↔ Connector

**Contrato**: `/contracts/<service>/vX.yaml`
**Cambio**: <campos, errores, versionado>
**Compatibilidad**: <estrategia de despliegue>

**Entrega**
1) PLAN (compat, fallback)
2) `git diff` con:
   - actualización de OpenAPI
   - adaptaciones en DTOs/controllers
   - tests de contrato
