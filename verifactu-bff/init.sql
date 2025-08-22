-- Fichero de inicialización de la base de datos para el proyecto VeriFactu
-- Versión 1.0
-- Tabla para los inquilinos (nuestros clientes)
CREATE TABLE tenant (
id SERIAL PRIMARY KEY,
nif VARCHAR(20) NOT NULL UNIQUE,
razon_social VARCHAR(255) NOT NULL,
modalidad VARCHAR(20) NOT NULL CHECK (modalidad IN ('VERIFACTU', 'NO_VERIFACTU')),
-- Metadatos del certificado, la información sensible se guardará en un vault
certificados_meta JSONB,
created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla para los registros de facturas
CREATE TABLE invoice_record (
id SERIAL PRIMARY KEY,
tenant_id INTEGER REFERENCES tenant(id) ON DELETE CASCADE,
-- Hashes para el encadenamiento
hash_actual VARCHAR(64) NOT NULL,
hash_anterior VARCHAR(64),
-- Tipo de registro
tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ALTA', 'ANULACION')),
-- Datos básicos de la factura
serie VARCHAR(50) NOT NULL,
numero VARCHAR(50) NOT NULL,
fecha_emision DATE NOT NULL,
emisor_nif VARCHAR(20) NOT NULL,
receptor_nif VARCHAR(20),
-- Importes. Usamos DECIMAL para evitar problemas con flotantes.
base_total DECIMAL(12, 2) NOT NULL,
cuota_total DECIMAL(12, 2) NOT NULL,
importe_total DECIMAL(12, 2) NOT NULL,
-- Guardamos el desglose completo en formato JSON por si es necesario
desglose_iva JSONB,
-- Estado del envío a la AEAT
estado_aeat VARCHAR(50) DEFAULT 'PENDIENTE',
aeat_request_id VARCHAR(100),
-- Guardamos la respuesta completa de la AEAT para auditoría
respuesta_aeat TEXT,
created_at TIMESTAMPTZ DEFAULT NOW(),
-- Una factura es única por inquilino, serie y número
UNIQUE (tenant_id, serie, numero)
);

-- Tabla para registrar los intentos de envío a la AEAT
CREATE TABLE dispatch (
id SERIAL PRIMARY KEY,
invoice_record_id INTEGER REFERENCES invoice_record(id) ON DELETE CASCADE,
intento INTEGER NOT NULL,
ts TIMESTAMPTZ DEFAULT NOW(),
resultado VARCHAR(50),
http_code INTEGER,
error_code_aeat VARCHAR(50),
-- Guardamos el payload enviado en cada intento para depuración
raw_request TEXT
);

-- Tabla para registrar eventos importantes del sistema (auditoría)
CREATE TABLE event_log (
id SERIAL PRIMARY KEY,
tenant_id INTEGER REFERENCES tenant(id) ON DELETE CASCADE,
tipo_evento VARCHAR(100) NOT NULL,
detalle TEXT,
created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creación de índices para acelerar las búsquedas más comunes
CREATE INDEX idx_invoice_record_estado ON invoice_record(estado_aeat);
CREATE INDEX idx_invoice_record_fecha ON invoice_record(fecha_emision);