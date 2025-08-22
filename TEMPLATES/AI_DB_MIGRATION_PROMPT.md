# PROMPT — Migración de base de datos (TypeORM/PostgreSQL)

**Contexto**: Políticas ADR-0002. No modificar migraciones antiguas; crear nuevas.
**Cambio deseado**: <schema change>
**Impacto**: <data/backfill/índices/locks>

**Entrega**
1) PLAN con estrategia (idempotencia, tiempos, índices, rollback)
2) `git diff` con:
   - nueva migración `migrations/YYYYMMDDHHmm-<scope>.ts`
   - ajustes en entidades/repos si aplica
   - tests de integración si aplica
