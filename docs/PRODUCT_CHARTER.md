# PRODUCT CHARTER — VeriFactu

## Problema
Miles de PYMES en España no usan un software de facturación moderno. La nueva normativa exige emitir facturas con requisitos específicos (encabezados, QR, trazabilidad, registro de eventos, etc.) y reportar de forma fiable. Migrar su ERP/TPV/Excel no es viable para muchas.

## Objetivo (Norte)
Proveer una **pasarela de cumplimiento invisible**: el cliente sigue usando su herramienta habitual (ERP/TPV/Word/Excel). Nosotros convertimos automáticamente sus PDFs a lo exigido por la ley y registramos la trazabilidad, sin fricciones.

## Usuarios objetivo
- PYMES y comercios con sistemas legacy o sin facturador.
- Integradores/consultoras que necesitan “cumplir ya” sin rehacer aplicaciones.

## Propuesta de valor
- **Cero fricción**: instala un conector de escritorio, elige una carpeta y listo.
- **Cumplimiento automático**: convertimos la factura (metadatos, QR, etc.).
- **Trazabilidad**: “libro de incidencias” y registro auditable de eventos.
- **Seguridad**: API key por tenant; sólo facturas autorizadas.

## Flujo (alto nivel)
1. Alta de cliente (onboarding asíncrono con n8n + Gemini).
2. El cliente descarga el **conector (Electron)** y configura una carpeta.
3. El conector **vigila** la carpeta (chokidar) y toma cada nuevo PDF.
4. Envía el PDF a nuestro **BFF** (o webhook n8n) con **API key**.
5. **BFF** valida, transforma al formato requerido, genera QR/encabezados y persiste.
6. Registramos evento en `event_log` y publicamos estado en el **dashboard**.

## Alcance (lo que sí es)
- Pasarela de cumplimiento Veri*Factu: recepción, validación, transformación, registro y entrega.

## No-alcance (lo que NO haremos)
- No construir un ERP ni un sistema de contabilidad completo.
- No forzar al cliente a cambiar de herramienta de facturación.

## Principios
- “**Invisible**”: no cambiar el hábito del cliente.
- “**Seguro por defecto**”: API key y mínimos privilegios.
- “**Observabilidad**”: todo evento relevante queda en `event_log`.
- “**Automatizable**”: flujos orquestados en n8n; IA asistiendo, no decidiendo sola.
