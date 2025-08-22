const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser'); // Herramienta para leer el contenido

const app = express();
const port = 8000;

// Usamos la herramienta para que el servidor entienda el XML que le llega
app.use(bodyParser.text({ type: 'text/xml' }));

// --- RUTAS GET PARA SERVIR LOS ARCHIVOS DE DEFINICIÓN ---
app.get('/aeat.wsdl', (req, res) => {
  const filePath = path.join(__dirname, 'aeat.wsdl');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Error: aeat.wsdl no encontrado.');
    res.type('application/xml').send(data);
  });
});

app.get('/FacturaJustificanteV1.xsd', (req, res) => {
  const filePath = path.join(__dirname, 'FacturaJustificanteV1.xsd');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Error: FacturaJustificanteV1.xsd no encontrado.');
    res.type('application/xml').send(data);
  });
});

app.get('/SuministroInformacion.xsd', (req, res) => {
  const filePath = path.join(__dirname, 'SuministroInformacion.xsd');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Error: SuministroInformacion.xsd no encontrado.');
    res.type('application/xml').send(data);
  });
});

// --- RUTA POST PARA RECIBIR LAS FACTURAS ---
app.post('/sif', (req, res) => {
    console.log('✅ El simulador ha recibido una factura!');
    console.log('--- Contenido de la factura (XML): ---');
    console.log(req.body); // Ahora sí debería mostrar el XML
    console.log('------------------------------------');

    const respuestaSOAP = `
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <RespuestaSuministro>
            <Respuesta>
                <CSV>CSV_SIMULADO_123456789</CSV>
                <DatosPresentacion>
                    <NIFPresentador>B12345678</NIFPresentador>
                    <TimestampPresentacion>12-08-2025 16:30:00</TimestampPresentacion>
                </DatosPresentacion>
                <Cabecera>
                    <IDVersionSii>1.0</IDVersionSii>
                    <Titular>
                        <NombreRazon>ACME SL</NombreRazon>
                        <NIF>B12345678</NIF>
                    </Titular>
                </Cabecera>
                <Estado>Correcto</Estado>
            </Respuesta>
        </RespuestaSuministro>
      </soap:Body>
    </soap:Envelope>
    `;
    res.type('application/xml');
    res.send(respuestaSOAP);
});

app.listen(port, () => {
  console.log(`🤖 Simulador de AEAT (v5 - FINAL CON PARSER) escuchando en http://localhost:${port}`);
});