# Flujo con IA (Gemini + diffs)

## Mantra
**Plan → Diff → Test → Merge**.  
La IA trabaja por **parches** y respeta `/docs/*.md`.

## Por ticket
1. Si hay cambio de diseño, añade ADR en `/docs/DECISIONS.md`.
2. Abre sesión nueva en Gemini y pega el prompt de `TEMPLATES/AI_TICKET_PROMPT.md`.
3. Lista archivos relevantes y (opcional) el SHA base.
4. Pide PLAN → valida → pide `git diff`.
5. Aplica el parche; ejecuta lint/tipos/tests.
6. Si falla algo, devuelve solo logs y pide un diff de ajuste.
7. En bugs, usa `AI_BUGFIX_PROMPT.md` y añade test de regresión.
8. Para DB/n8n/Electron/Contratos, usa los prompts específicos.

## CI
- Workflow `ci-verifactu.yml` ejecuta lint/tipos/tests y levanta PostgreSQL en CI.
- Ajusta `cd <ruta>` en cada job si tu monorepo usa otras carpetas.

::contentReference[oaicite:0]{index=0}
