# Convenciones
## General
- TS estricto; sin `any` implícito salvo justificado.
- Commits: Conventional Commits (`feat|fix|refactor|docs|test(scope): ...`).

## NestJS
- Carpetas: `modules/<name>/{controllers,services,entities,dto}`.
- DTOs con `class-validator` y `class-transformer`.
- `Repository` por agregado; sin lógica de dominio en controladores.

## TypeORM
- Entities en `entities/`; Migrations en `migrations/`.
- No `synchronize: true` en producción/test CI.
- Nombres de columnas y constraints predecibles (`snake_case`).

## Frontend
- JS módulo (ESM); Tailwind con clases utilitarias y componentes reutilizables.
- Convención de data-testid para e2e.

## Electron
- Mantener lógica de FS/OS en proceso main; UI en renderer.
- `electron-store` con `schema` para validar config.
