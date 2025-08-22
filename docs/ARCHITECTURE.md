# Arquitectura — verifactu

## Backend (Sala de Máquinas)
- **Servicios**: `verifactu-bff` y `verifactu-connector`
- **Lenguaje**: TypeScript
- **Framework**: NestJS
- **DB**: PostgreSQL
- **ORM**: TypeORM
- **Invariantes**
  - Transacciones: toda operación multi-aggregate debe ser transaccional.
  - Repositorios: acceso a datos solo vía repositorios; prohibidas consultas ad hoc salvo justificación.
  - Migraciones: toda alteración de esquema pasa por migración versionada.

## Orquestación (Cerebro)
- **n8n** para flujos visuales.
- **Gemini API** para validación, limpieza de texto y personalización.

## Frontend
- HTML, CSS, JS (Vanilla) + Tailwind CSS.
- Páginas: `index.html`, `login.html`, `dashboard.html`.

## Conector de Escritorio (Impresora Virtual)
- **Electron** (Win/macOS/Linux).
- **Librerías**: `chokidar` (watch de carpeta de facturas) y `electron-store` (config usuario).

## Fronteras y contratos
- BFF ↔ Connector: contratos REST/HTTP (o gRPC si aplica) versionados (v1, v2...).
- BFF ↔ Frontend: API pública documentada (OpenAPI si aplica).
- Orquestación ↔ Servicios: webhooks/colas; flujos de n8n versionados en repo (`/flows`).

## Datos clave
- Entidades: `Invoice`, `Customer`, `User`, `Template`, etc.
- Relaciones y restricciones en `docs/DECISIONS.md` (ADR de datos).
