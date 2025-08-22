import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { AeatService } from './aeat/aeat.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly aeatService: AeatService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('enviar-factura')
  async enviarFactura(@Body() datosFacturaGuardada: any) { // Cambiamos a 'any' para más flexibilidad
    return this.aeatService.enviarFactura(datosFacturaGuardada);
  }
}
