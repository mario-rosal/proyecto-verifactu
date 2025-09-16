Memoria: El Proyecto VeriFactu

Este documento sirve como un registro técnico y estratégico completo del proyecto VeriFactu, desde su concepción hasta la finalización de la fase de desarrollo principal.

1. El "Porqué": Visión Estratégica y Oportunidad de Mercado
   1.1. El Problema: La Ley Antifraude (Veri*Factu)
   El proyecto nace como respuesta directa a la Ley Antifraude española (Real Decreto 1007/2023), que entra en vigor en 2026. Esta ley impone una transformación digital obligatoria en la facturación para combatir el fraude fiscal. Los requisitos clave son:
   Inalterabilidad: Prohibición de borrar o modificar facturas.
   Trazabilidad: Cada factura debe estar encadenada a la anterior mediante una huella digital criptográfica (hash SHA-256).
   Verificabilidad: Todas las facturas deben incluir un código QR y la leyenda "VERI*FACTU" para su rápida comprobación.
   Registro de Eventos: El software debe mantener una "caja negra" (event_log) de todas las operaciones críticas.
   1.2. Nuestra Solución: Invisibilidad y Cero Fricción
   En lugar de competir en el saturado mercado de los softwares de facturación, nuestro producto es una pasarela de cumplimiento como servicio (Compliance as a Service).
   Público Objetivo (El "Nicho Dorado"): Nos dirigimos a las PYMES y autónomos que ya utilizan un software de gestión o TPV antiguo que no será actualizado. Estas empresas se enfrentan al dilema de una migración costosa o el riesgo de sanciones.
   Propuesta de Valor: No vendemos un nuevo programa, sino un "adaptador mágico". Nuestra solución se integra de forma invisible con su flujo de trabajo actual, haciendo que su software obsoleto cumpla con la nueva ley. Les vendemos continuidad de negocio y tranquilidad fiscal.
   1.3. El Factor Diferencial: El Conector "Impresora Virtual"
   Nuestra ventaja competitiva más potente es la estrategia de onboarding de "cero fricción". En lugar de una compleja integración vía API, el cliente descarga un instalador personalizado desde su dashboard. Este instalador, construido con Electron, crea una "Impresora Virtual" en su sistema. El cliente simplemente "imprime" sus facturas en esta nueva impresora, y nuestro sistema se encarga del resto. La API Key viene pre-configurada, eliminando cualquier barrera técnica para el usuario.
2. El "Cómo": Arquitectura Técnica y Tecnologías
   Hemos construido un sistema robusto basado en una arquitectura de microservicios, donde cada componente tiene una responsabilidad clara.
   Backend (verifactu-bff):
   Stack: NestJS (TypeScript), TypeORM, PostgreSQL.
   Rol: Es el "guardián del estado y la lógica de negocio". Gestiona la API REST, la base de datos, la autenticación de usuarios (con bcrypt y JWT), la lógica de "Trabajos" asíncronos y la generación de API Keys.

   Endpoints relevantes (consolidados):

    - **POST /v1/connector-package** _(JWT-only)_

   - **GET /v1/invoices/:id/pdf** _(público según guard global)_
      - Genera **PDF A4** en tiempo real con `pdf-lib` + `qrcode`.
      - Imprime visible: leyenda **“VERI*FACTU — Factura verificable en la sede electrónica de la AEAT”** y el **`hash_actual`**.
      - La URL del **QR** incluye los campos del `invoice_record` (`emisor_nif`, `serie`, `numero`, `fecha_emision`, `importe_total`, `hash_actual`).
      - **Cabeceras**: `Content-Type: application/pdf`, `Content-Disposition: inline` con nombre `verifactu-&lt;serie&gt;-&lt;numero&gt;.pdf`.

   - **POST /v1/connector-package/tickets** _(JWT-only)_
     - Crea el **ZIP temporal** en `os.tmpdir()` y devuelve `{ url, filename, size, expiresAt }` firmado (HMAC-SHA256, `exp`).
   - **GET /v1/connector-package/tickets/:token** _(público por token)_
     - **Valida** firma/expiración; sirve el ZIP con `Content-Length` y **borra** el artefacto tras la descarga.

   **Notas de producto**: con la exclusión de `win-unpacked/` el ZIP típico queda en **~75–79 MB** (instalador + config).

   Conector AEAT (verifactu-connector):
   Stack: NestJS (TypeScript), soap.
   Rol: El "servicio de mensajería" especializado en la comunicación SOAP con la AEAT.

   Seguridad (resumen):

   - **Logging estructurado (global)**:
     - Interceptor **global** escribe JSON por línea en `verifactu-bff/logs/app-YYYY-MM-DD.jsonl`.
     - Propaga `x-request-id` y registra `method`, `url`, `status`, `duration_ms`, etc.

   - **Cabeceras de seguridad (Helmet)** _(nuevo)_:

     - **CSP** compatible con el dashboard: en **dev** permite `\'unsafe-inline\'` y `\'unsafe-eval\'`; en **producción** es más estricta (sin `\'unsafe-eval\'`).
     - **X-Frame-Options**: `DENY` y **`frame-ancestors \'none\'`** en la propia CSP para impedir _embedding_ no autorizado.
     - **Referrer-Policy**: `strict-origin-when-cross-origin`.
     - **HSTS**: activado **solo en producción/HTTPS**; desactivado en desarrollo (HTTP) para evitar falsos positivos.
     - **CORS**: **sin cambios** respecto a la configuración previa (whitelist por `CORS_ORIGINS`, mismos headers expuestos).
     - **Verificación**: `HEAD /v1/healthz` muestra las cabeceras; en dev **no** aparece `Strict-Transport-Security`.

   - **Autenticación JWT**: emisión firmada con **`JWT_SECRET`**; durante rotación, las rutas protegidas **aceptan también** tokens firmados con **`JWT_SECRET_NEXT`** (ventana de gracia).
   - **ApiKeyGuard global (JWT OR x-api-key)** con _whitelist_ mínima: `OPTIONS`, `GET /healthz`, `POST /v1/auth/login`, `GET /v1/jobs/:id`, `GET /v1/connector-package/tickets/:token` (token firmado).
   - **Descargas con ticket**: `GET /v1/connector-package/tickets/:token` permitido sin JWT **solo** con token HMAC válido (`DOWNLOAD_TICKET_SECRET`) y `exp`; verificación con `timingSafeEqual`.
   - **Sin secretos hardcodeados**: `JwtModule` y validadores leen de `.env`; `JWT_SECRET_NEXT` es **opcional** y solo para rotación segura.

   - **E2E de tickets (BFF)** :
     - Cobertura (GET `/v1/connector-package/tickets/:token`):
       - ✅ **Éxito** → `200 OK`, `Content-Type: application/zip`, `Content-Length` **exacto** y `> 0`, **borrado** del ZIP temporal al finalizar.
       - ❌ **Firma inválida** → `401 {"message":"Firma inválida"}`.
       - ❌ **Token expirado** → `401 {"message":"Token expirado"}`.
       - ❌ **Reuso del token** (ZIP ya eliminado) → `401 {"message":"Artefacto no disponible"}`.
       - 🔓 **Ruta pública/whitelist** (sin JWT/x-api-key) con **token malformado** → `401 {"message":"Token inválido"}`.
     - Objetivo: asegurar verificabilidad (cabeceras correctas como `Content-Length`) y que **no se re-sirve** ni **re-crea** el artefacto temporal.
     - Estado: suites e2e en verde; se mantiene el test de whitelist existente.
   - **Servicio de purga de temporales (nuevo):**
     - El BFF incluye un servicio `TicketsPurgeService` que elimina los artefactos ZIP temporales en `os.tmpdir()` cuando han superado el TTL+GRACE.
     - Ahora emite siempre un log único por ejecución con el formato `purged N files` (N puede ser 0).
     - Se añadió un test unitario aislado que simula un directorio temporal y verifica tanto el borrado de archivos expirados como el log esperado.

   Simulador AEAT (mock-server.js):
   Stack: Node.js, Express.
   Rol: Un simulador que nos sirve los archivos WSDL/XSD y emula las respuestas SOAP, permitiéndonos desarrollar de forma independiente y fiable.
   Orquestador (n8n):
   Rol: El "sistema nervioso central". Gestiona todos los flujos de trabajo asíncronos (onboarding, procesamiento de facturas) y actúa como el punto de integración para la IA.
   Inteligencia Artificial (Google Gemini):
   Rol: Actúa como un conjunto de "agentes expertos" especializados:
   "Gestor de Alta": Limpia y enriquece los datos de nuevos clientes.
   "Copywriter Creativo": Genera mensajes de bienvenida personalizados.
   "Extractor de Datos": Parsea el texto de los PDFs de facturas.
   "Auditor Fiscal": Realiza una pre-validación de las facturas.
   Frontend (UI):
   Stack: HTML, JavaScript ("Vanilla JS"), Tailwind CSS.
   Componentes: index.html (Onboarding), login.html, dashboard.html, y las páginas para la recuperación de contraseña.
   Capacidades del Dashboard (estado actual):

   - Listado de facturas y descarga del **PDF oficial Veri*Factu** (sello + QR) vía **`GET /v1/invoices/:id/pdf`**.
   - **Gestión de API Keys** (listar, crear —se muestra solo una vez—, revocar) protegida con JWT.
   - **Descarga del Conector**:
     - Flujo **ticketizado**: `POST /v1/connector-package/tickets` → navegar a `GET /v1/connector-package/tickets/:token`.
     - Usa _File System Access API_ si está disponible para **“Guardar como…”** y progreso en botón; _fallback_ universal a Blob + `&lt;a download&gt;`.

   Conector de Escritorio (verifactu-printer-connector):
   Stack: Electron, chokidar, electron-store, axios.
   Rol: El "mensajero". Una aplicación ligera que vigila una carpeta, lee la API Key de un config.json y envía los nuevos PDFs a n8n.

   **Backups & Restore (consolidado):**

   - **Scripts de backup** (BFF):
     - Windows (PowerShell): `verifactu-bff/scripts/backup/backup.ps1`
     - Bash opcional: `verifactu-bff/scripts/backup/backup.sh`
   - **Funcionamiento:** ejecutan `pg_dump` contra la BD del BFF y generan un artefacto con timestamp en `verifactu-bff/backups/`. Si existe `verifactu-bff/logs/*.jsonl`, se copian al backup.
   - **Requisitos:** tener disponible `pg_dump`. En Windows puede usarse el binario del runtime de pgAdmin 4 (p. ej. `C:\Users\<usuario>\AppData\Local\Programs\pgAdmin 4\runtime\pg_dump.exe`) pasándolo como parámetro al script.
   - **Restore:** ver guía `verifactu-bff/docs/RESTORE.md` con el **orden exacto**: definir `DATABASE_URL` o variables `PG*` → descomprimir → crear BD si no existe → `psql -f dump.sql`.
   - **Nota conocida:** si durante el restore aparece el error `unrecognized configuration parameter "transaction_timeout"`, quitar la línea `SET transaction_timeout` del `.sql` antes de ejecutarlo (según versión/entorno).

3. El "Qué": Resumen del Progreso por Sprints
   Sprint 1 (Cimientos): Se construyó el motor del backend (bff y connector) y se tomó la decisión estratégica de crear el simulador para garantizar la velocidad del desarrollo.
   Sprint 2 (Asincronía e IA): Se refactorizó el backend a una arquitectura asíncrona basada en "Jobs". Se construyó el flujo de onboarding en n8n con validación por IA y se creó el frontend de registro con sondeo (polling) para una experiencia en tiempo real.
   Sprint 3 (Funcionalidad Principal): Se construyó el dashboard.html y se conectó al backend para mostrar datos reales. Se implementó el flujo completo de n8n para procesar un "Job" de factura, sellarlo en el bff y enviarlo al conector AEAT (simulado).
   Sprint 4 (Seguridad y Acceso): Se implementó el sistema de autenticación de usuarios de principio a fin: la tabla users con roles, los endpoints de registro y login con JWT, el AuthGuard para proteger rutas y el flujo completo de recuperación de contraseña.
   Sprint 5 (El Conector Disruptivo): Se construyó y depuró la aplicación de escritorio "Impresora Virtual" con Electron. Se validó la arquitectura de comunicación segura (preload script) y se implementó la lógica para vigilar una carpeta y enviar los archivos a n8n con una API Key pre-configurada.
   Sprint 6 (Cumplimiento Avanzado): Se añadieron las capas finales de cumplimiento normativo, destacando la implementación del "Libro de Incidencias" (la tabla event_log y los endpoints correspondientes en el bff).

   Sprint 7 (DASH-APIKEYS-UI): Se incorporó en el dashboard la **gestión de API Keys** para cada tenant (listar metadatos, crear con visualización única y revocar). El backend expone `GET/POST/DELETE /api-keys` protegido con JWT; el dashboard consume estos endpoints y muestra feedback de errores.

   **Sprint E/F — PDF oficial consolidado**: Se consolidó en el BFF el endpoint **`GET /v1/invoices/:id/pdf`** que genera **en tiempo real** el **PDF oficial Veri*Factu** con leyenda y **QR** (sin dependencias de S3/MinIO). El Dashboard expone el botón **“Descargar Factura Veri*Factu (PDF)”** que navega a dicho endpoint. El QR codifica la URL de verificación con los campos de `invoice_record` (`emisor_nif`, `serie`, `numero`, `fecha_emision`, `importe_total`, `hash_actual`).

   Diagrama del flujo completo:

   ```
   [ERP/TPV Antiguo]
           │ (Imprimir PDF)
           ▼
   [Conector Electron]
    (watcher + API Key)
           │
           ▼
     [Webhook n8n]
           │
           ├─ OCR / IA (Gemini) → Datos estructurados
           │
           └─► BFF /invoices (Job: INVOICE_SUBMISSION)
                     │
                     ▼
              [invoice_record DB]
                     │
                     └─ Encadenado con hash
                     │
                     ▼
           ┌───────────────────────────────┐
           │ Sprint E:                     │
           │ BFF /invoices/:id/pdf/stamp   │
           │ Genera PDF con QR + leyenda   │
           └───────────────────────────────┘
                     │
                     ▼
           ┌───────────────────────────────┐
           │ Sprint F:                     │
           │ Guardar PDF en S3/MinIO       │
           │ (stamped/<invoice_id>.pdf)    │
           └───────────────────────────────┘
                     │
                     ▼
            [Dashboard del Cliente]
           ┌───────────────────────────────┐
           │ GET /invoices/:id/pdf/stamped │
           │ Botón “Descargar Factura”     │
           └───────────────────────────────┘
                     │
                     ▼
             [PDF Oficial Veri*Factu]
    (contenido original + sello + QR verificable)
   ```

4. El "Hacia Dónde": Próximos Pasos
   Con el desarrollo funcional principal ya completado, el proyecto entra en su fase final de preparación para el lanzamiento.
   PDF Oficial Consolidado: Ya está implementada la generación del PDF oficial de la factura con código QR y la leyenda "VERI*FACTU", mediante el endpoint `/v1/invoices/:id/pdf/stamp` (subida y estampado) y `/v1/invoices/:id/pdf/stamped` (descarga). El flujo de n8n invoca este servicio tras el sellado.
   Empaquetado y Despliegue: Usamos electron-builder (NSIS y NSIS Web) para crear los instaladores profesionales del conector. El dashboard genera un ZIP con `config.json` y el instalador actualizado. Próximo paso: disponer de hosting público (S3/MinIO) para servir el paquete `.nsis.7z` del Web-Setup.
   Integración Real con la AEAT: El último paso será obtener un certificado de sello electrónico oficial y "cambiar el enchufe" del verifactu-connector, pasando de nuestro simulador al entorno de producción de la Agencia Tributaria.

   Evidencia técnica (descarga & distribución):

   - **Antes (instalador completo)**: `POST /v1/connector-package` → ZIP (`config.json` + `.exe`) con `Content-Length` **~75–79 MB**.
   - **Ahora (NSIS Web)**: bundle de dashboard `verifactu-connector-web.zip` **~0.6 MB** (`Web-Setup.exe` + `config.json`).
   - `POST /v1/connector-package/tickets` → devuelve `url` firmada + `size`; `GET` posterior entrega el ZIP y elimina el temporal.
   - `event_log` registra `CONFIG_UPDATE` en ambos flujos (con `ticket: true` cuando aplica).

### Anexo A — Variables de entorno (producción y rotación)

| Variable                            | Uso                                | Notas                                                       |
| ----------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| `NODE_ENV`                          | entorno                            | `production` en despliegue                                  |
| `PORT`                              | puerto BFF                         | por defecto `3001`                                          |
| `CORS_ORIGINS`                      | **whitelist CORS** (coma-separado) | ej. `https://app.midominio.com,https://admin.midominio.com` |
| `JWT_SECRET`                        | firma/verificación JWT             | **obligatorio**                                             |
| `JWT_SECRET_NEXT` (opcional)        | **rotación** JWT                   | aceptar dual en ventana de gracia                           |
| `DOWNLOAD_TICKET_SECRET`            | HMAC tickets de descarga           | **obligatorio** · **mínimo 24 chars** (validado en runtime) |
| `DOWNLOAD_TICKET_SECRET_NEXT` (op.) | **rotación** de tickets            | verificación intenta ambos                                  |

**Operativa de rotación** (JWT/tickets):

1. Generar y cargar `*_NEXT` en `.env`.
2. Desplegar (aceptación **dual**).
3. Promocionar: mover `*_NEXT` → base (`JWT_SECRET` / `DOWNLOAD_TICKET_SECRET`) y vaciar `*_NEXT`.
4. Revocar el secreto antiguo (tokens antiguos dejan de ser válidos tras la gracia).

5. Flujo Completo: De Cero a Factura Legal
   Aquí se detalla el viaje completo del usuario, desde que descubre el servicio hasta que emite su primera factura 100% legal.
   Fase A: Onboarding y Puesta en Marcha
   Registro (Frontend): Un nuevo cliente (ej. un restaurante) llega a nuestra web y rellena el formulario de index.html con los datos de su empresa y los de su cuenta de administrador.
   Orquestación del Alta (n8n): El formulario envía los datos a un workflow de n8n. Este flujo utiliza un agente de IA para limpiar y validar los datos. Si todo es correcto, llama a nuestro bff.
   Creación en Backend (bff): El bff ejecuta una transacción segura que crea el tenant (la empresa), el primer user (el administrador) y genera automáticamente la primera API Key única para ese cliente.
   Bienvenida y Login: El usuario es redirigido a la página de login.html y puede iniciar sesión con las credenciales que acaba de crear.
   Descarga del Conector (Dashboard): Al iniciar sesión, el usuario accede a su dashboard.html. Aquí encuentra un botón **“Descargar Conector”**. Al hacer clic, nuestro **bff** invoca `POST /connector-package` y entrega un **ZIP** que contiene:

   - **Instalador Windows** del conector (Electron/NSIS), cuando está disponible.
   - **`config.json`** con una **API Key dedicada** y el **tenantId** generados justo en esa solicitud.
     Instalación "Cero Fricción" (Electron): El usuario instala el conector. En su primer arranque, la aplicación detecta el config.json, guarda la API Key de forma segura y le pide al usuario que seleccione la carpeta donde su TPV "imprime" las facturas en PDF. A partir de este momento, el conector se inicia automáticamente con el ordenador y trabaja en segundo plano.
     Fase B: Emisión de una Factura (El Día a Día)
     "Impresión" desde el Software Antiguo: El camarero del restaurante genera una factura en su TPV como siempre. Al finalizar, en lugar de imprimirla en papel, la "imprime" en la carpeta que el conector está vigilando.
     Detección y Envío (Electron): Nuestro conector (chokidar) detecta el nuevo archivo PDF al instante. Lee la API Key guardada y envía el archivo PDF de forma segura a un webhook específico de n8n.
     Procesamiento Inteligente (n8n):
     El workflow [Facturacion] - 3. Procesador de PDFs recibe el archivo.
     Valida la API Key contra nuestro bff para identificar al cliente.
     Usa un nodo de OCR para extraer el texto del PDF.
     Le pasa el texto a un agente de IA (Gemini) que lo estructura en un formato JSON limpio.
     Llama al bff para crear un "Job" de tipo INVOICE_SUBMISSION con los datos extraídos.
     Activa el workflow [Facturacion] - 2. Procesador Asíncrono.
     Sellado y Envío (n8n y bff):
     El segundo workflow de n8n realiza las validaciones finales (NIF del receptor, etc.).
     Llama al endpoint inteligente del bff para que calcule el hash encadenado y guarde el registro oficial de la factura (invoice_record) en la base de datos.
     Finalmente, le pasa la factura ya sellada al verifactu-connector para su comunicación con la AEAT (simulada).
     **Generación del Documento Final (Consolidado):** el BFF genera el PDF oficial con QR y leyenda "VERI*FACTU" y lo expone vía `GET /v1/invoices/:id/pdf`.
     Disponibilidad en el Dashboard: El dueño del restaurante, al entrar en su dashboard.html, verá la nueva factura en su listado, con el estado "Completado". Desde ahí, podrá descargar el PDF oficial y legal, que es el que debe entregar a su cliente.

6. El Principio de la "Fuente Única de la Verdad" (Single Source of Truth)
   Lo más importante que hay que entender es que, desde el momento en que un cliente empieza a usar nuestro sistema, su software antiguo (su TPV, su Word, su Excel) pierde toda validez fiscal. Se convierte en una simple herramienta para introducir datos.
   Nuestra plataforma se convierte en la única y exclusiva "Fuente de la Verdad" para sus facturas.
   ¿Qué implicaciones tiene esto?
   Validez Legal: La única factura que es legalmente válida es la que se genera en nuestro sistema y se puede descargar desde nuestro Dashboard. Esa es la que contiene el hash, el QR y la que, en caso de inspección, la AEAT considerará como el documento oficial.
   Confianza y Responsabilidad: Esto significa que el cliente deposita en nosotros una confianza total para la custodia de sus registros fiscales. No somos un complemento, somos su nuevo libro de contabilidad digital y oficial. Esto subraya la importancia de la seguridad, las copias de seguridad y la fiabilidad de toda la arquitectura que hemos construido.
   Modelo de Negocio (Suscripción): Este principio justifica perfectamente un modelo de negocio por suscripción mensual o anual. El cliente no paga por un programa, paga por un servicio continuo de custodia, legalidad y tranquilidad fiscal. Mientras pague, su "archivo fiscal" está seguro y accesible en nuestro dashboard.
   Este concepto es el argumento de venta más potente que tenéis. No ofrecéis una simple herramienta, ofrecéis convertiros en el departamento de cumplimiento normativo digital de vuestros clientes.