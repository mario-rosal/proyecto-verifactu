import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as soap from 'soap';

@Injectable()
export class AeatService implements OnModuleInit {
  private readonly logger = new Logger(AeatService.name);
  private readonly wsdlUrl = 'http://localhost:8000/aeat.wsdl';
  private soapClient: soap.Client;

  async onModuleInit() {
    try {
      this.logger.log(`Conectando al WSDL del SIMULADOR en: ${this.wsdlUrl}`);
      this.soapClient = await soap.createClientAsync(this.wsdlUrl);
      this.logger.log('✅ ¡ÉXITO! Cliente SOAP creado correctamente desde el SIMULADOR.');
    } catch (error) {
      this.logger.error('Error al inicializar el cliente SOAP desde el SIMULADOR:', error);
    }
  }

  public async enviarFactura(datosFacturaGuardada: any): Promise<any> {
    this.logger.log('Recibida petición para enviar factura:', datosFacturaGuardada);

    const args = {
      SuministroFacturasJustificantes: {
        Cabecera: {
          IDVersionSii: '1.0',
          Titular: {
            // 👇 CORRECCIÓN AQUÍ 👇
            NombreRazon: datosFacturaGuardada.tenant.razonSocial,
            NIF: datosFacturaGuardada.emisorNif,
          },
        },
        Registro: {
          ID: {
            IDType: '01',
            ID: datosFacturaGuardada.receptorNif,
          },
          FechaOperacion: datosFacturaGuardada.fechaEmision.split('-').reverse().join('-'),
          Importe: parseFloat(datosFacturaGuardada.importeTotal).toFixed(2),
          Concepto: datosFacturaGuardada.desgloseIva[0]?.desc || 'Varios',
        },
      },
    };

    try {
      this.logger.log('Enviando datos al servicio SOAP simulado...');
      const [result] = await this.soapClient.SuministroFacturasJustificantesAsync(args);
      this.logger.log('Respuesta recibida del simulador:', result);
      return result;
    } catch (error) {
      this.logger.error('Error durante la llamada SOAP:', error.message);
      throw new Error(`Error en la comunicación SOAP: ${error.message}`);
    }
  }
}