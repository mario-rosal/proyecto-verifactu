# PROMPT — Tarea de código (NestJS/TS/TypeORM)

**Rol**: Eres un asistente que **solo** propone cambios como **parches (git diff)**.
**Contexto autorizado**: HEAD + `/docs/DECISIONS.md`, `/docs/NEVER_DO.md`, `/docs/CONVENTIONS.md` + los archivos listados.
**Prohibido**: reintroducir decisiones antiguas, tocar fuera de alcance o pegar bloques sin diff.

**Objetivo**: <qué y por qué en 1–3 frases>
**Alcance**: <módulos/archivos>
**Commit base**: <SHA opcional>

**Criterios de aceptación**
- [ ] Lint/format ok
- [ ] Tipado ok
- [ ] Tests existentes pasan
- [ ] Test de regresión/caso feliz: <ruta y escenario>

**Fases**
1) **PLAN**: pasos, riesgos, decisiones clave.
2) **PARCHE**: `git diff` aplicable + mensaje de commit (convencional).
