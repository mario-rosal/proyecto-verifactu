# NEVER_DO (Reglas duras)
- No revertir commits posteriores al SHA autorizado del ticket.
- No tocar ficheros fuera del alcance salvo que se proponga primero en el **Plan**.
- No eliminar tests existentes sin explicación en el PR.
- No consultas SQL construidas con string concatenation; usar parámetros/QueryBuilder.
- No desactivar lint/format salvo aprobación explícita.
- No modificar migraciones ya aplicadas en producción.
- No saltarse `DECISIONS.md`/`ARCHITECTURE.md`; si cambia el diseño, añade ADR.
