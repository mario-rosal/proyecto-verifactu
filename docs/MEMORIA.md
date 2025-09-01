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
   Endpoints relevantes:
   - **POST /connector-package** *(JWT-only)*: genera una **API Key dedicada** para el tenant, construye y devuelve un **ZIP** con:
     - `config.json` `{ apiKey, tenantId }`
     - Binarios del conector **(instalador Windows Electron/NSIS si está disponible en `verifactu-printer-connector/bin`)**
     Además, registra en `event_log` un `CONFIG_UPDATE` con `details.action = CONNECTOR_PACKAGE_GENERATED`.
   Conector AEAT (verifactu-connector):
   Stack: NestJS (TypeScript), soap.
   Rol: El "servicio de mensajería" especializado en la comunicación SOAP con la AEAT.
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
   - Listado de facturas y descarga del **PDF oficial Veri*Factu** (sello + QR).
   - **Gestión de API Keys** (listar, crear —se muestra solo una vez—, revocar) protegida con JWT.
   Conector de Escritorio (verifactu-printer-connector):
   Stack: Electron, chokidar, electron-store, axios.
   Rol: El "mensajero". Una aplicación ligera que vigila una carpeta, lee la API Key de un config.json y envía los nuevos PDFs a n8n.
3. El "Qué": Resumen del Progreso por Sprints
   Sprint 1 (Cimientos): Se construyó el motor del backend (bff y connector) y se tomó la decisión estratégica de crear el simulador para garantizar la velocidad del desarrollo.
   Sprint 2 (Asincronía e IA): Se refactorizó el backend a una arquitectura asíncrona basada en "Jobs". Se construyó el flujo de onboarding en n8n con validación por IA y se creó el frontend de registro con sondeo (polling) para una experiencia en tiempo real.
   Sprint 3 (Funcionalidad Principal): Se construyó el dashboard.html y se conectó al backend para mostrar datos reales. Se implementó el flujo completo de n8n para procesar un "Job" de factura, sellarlo en el bff y enviarlo al conector AEAT (simulado).
   Sprint 4 (Seguridad y Acceso): Se implementó el sistema de autenticación de usuarios de principio a fin: la tabla users con roles, los endpoints de registro y login con JWT, el AuthGuard para proteger rutas y el flujo completo de recuperación de contraseña.
   Sprint 5 (El Conector Disruptivo): Se construyó y depuró la aplicación de escritorio "Impresora Virtual" con Electron. Se validó la arquitectura de comunicación segura (preload script) y se implementó la lógica para vigilar una carpeta y enviar los archivos a n8n con una API Key pre-configurada.
   Sprint 6 (Cumplimiento Avanzado): Se añadieron las capas finales de cumplimiento normativo, destacando la implementación del "Libro de Incidencias" (la tabla event_log y los endpoints correspondientes en el bff).

   Sprint 7 (DASH-APIKEYS-UI): Se incorporó en el dashboard la **gestión de API Keys** para cada tenant (listar metadatos, crear con visualización única y revocar). El backend expone `GET/POST/DELETE /api-keys` protegido con JWT; el dashboard consume estos endpoints y muestra feedback de errores.

   Sprint E (Sellado Visual de Facturas): Se implementó en el BFF el endpoint `POST /invoices/:id/pdf/stamp`, protegido con ApiKeyGuard. Este servicio recibe un PDF original en `multipart/form-data` y devuelve el mismo documento con un overlay de la leyenda “VERI*FACTU — Factura verificable en la sede electrónica de la AEAT” en cabecera y pie, junto con un código QR en la esquina superior derecha. El QR codifica la URL de verificación con los campos de `invoice_record` (`emisor_nif`, `serie`, `numero`, `fecha_emision`, `importe_total`, `hash_actual`). Se verificó mediante pruebas con `curl` que el PDF resultante conserva el contenido original y cumple el contrato de datos definido.

   Sprint F (Disponibilidad del PDF sellado en el Dashboard): Se implementó en el BFF el endpoint `GET /invoices/:id/pdf/stamped`, que permite a los clientes descargar directamente la factura oficial Veri*Factu desde su Dashboard. El sistema guarda los PDFs originales y sellados en un bucket S3-compatible (MinIO en desarrollo, Amazon S3 en producción). El flujo de n8n, al marcar una factura como “sellada”, llama al BFF para estampar el PDF y almacenarlo en la ruta `stamped/<invoice_id>.pdf`. El Dashboard incorpora un botón “Descargar Factura Veri*Factu (PDF)” que llama a este endpoint y entrega al cliente el documento oficial con leyenda y QR. Si el PDF aún no está disponible, se muestra el estado “En preparación”. El QR sigue codificando la URL de verificación con los campos de `invoice_record` (`emisor_nif`, `serie`, `numero`, `fecha_emision`, `importe_total`, `hash_actual`).

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
   Generación del Documento Final: El siguiente gran paso es implementar la generación del PDF oficial de la factura, que incluya el código QR y la leyenda "VERI\*FACTU". Esto se hará en un nuevo flujo de n8n que tomará los datos de la factura ya sellada.
   Empaquetado y Despliegue: **Ya usamos electron-builder (NSIS)** para generar el instalador del conector y la **descarga personalizada** desde el dashboard está implementada mediante `POST /connector-package` (ZIP con instalador + `config.json`). Paralelamente, desplegaremos nuestros servicios de backend y n8n en una infraestructura en la nube.
   Integración Real con la AEAT: El último paso será obtener un certificado de sello electrónico oficial y "cambiar el enchufe" del verifactu-connector, pasando de nuestro simulador al entorno de producción de la Agencia Tributaria.
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
   Generación del Documento Final (Próximo Sprint): Un último paso (aún por construir) tomará los datos de la factura sellada y generará un nuevo PDF. Este documento incluirá el código QR y la leyenda "VERI\*FACTU".
   Disponibilidad en el Dashboard: El dueño del restaurante, al entrar en su dashboard.html, verá la nueva factura en su listado, con el estado "Completado". Desde ahí, podrá descargar el PDF oficial y legal, que es el que debe entregar a su cliente.

6. El Principio de la "Fuente Única de la Verdad" (Single Source of Truth)
   Lo más importante que hay que entender es que, desde el momento en que un cliente empieza a usar nuestro sistema, su software antiguo (su TPV, su Word, su Excel) pierde toda validez fiscal. Se convierte en una simple herramienta para introducir datos.
   Nuestra plataforma se convierte en la única y exclusiva "Fuente de la Verdad" para sus facturas.
   ¿Qué implicaciones tiene esto?
   Validez Legal: La única factura que es legalmente válida es la que se genera en nuestro sistema y se puede descargar desde nuestro Dashboard. Esa es la que contiene el hash, el QR y la que, en caso de inspección, la AEAT considerará como el documento oficial.
   Confianza y Responsabilidad: Esto significa que el cliente deposita en nosotros una confianza total para la custodia de sus registros fiscales. No somos un complemento, somos su nuevo libro de contabilidad digital y oficial. Esto subraya la importancia de la seguridad, las copias de seguridad y la fiabilidad de toda la arquitectura que hemos construido.
   Modelo de Negocio (Suscripción): Este principio justifica perfectamente un modelo de negocio por suscripción mensual o anual. El cliente no paga por un programa, paga por un servicio continuo de custodia, legalidad y tranquilidad fiscal. Mientras pague, su "archivo fiscal" está seguro y accesible en nuestro dashboard.
   Este concepto es el argumento de venta más potente que tenéis. No ofrecéis una simple herramienta, ofrecéis convertiros en el departamento de cumplimiento normativo digital de vuestros clientes.