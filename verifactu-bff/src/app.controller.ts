// Ubicación: verifactu-bff/src/app.controller.ts

import { Controller, Post, Body, Get, Param, Patch, ParseUUIDPipe, ParseIntPipe, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AppService } from './app.service';
import { CreateJobDto, UpdateJobDto } from './dto/job.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UnifiedRegisterDto } from './dto/auth.dto';
import { AuthGuard } from './auth/auth.guard';
import { CreateEventDto } from './dto/create-event.dto'; // <-- 1. Importar el nuevo DTO
import { ApiKeyGuard } from './auth/apikey.guard'; // <-- 2. Importar el nuevo guardián

@Controller('v1')
export class AppController {
  constructor(private readonly appService: AppService) {}

   // --- 👇 NUEVO ENDPOINT PARA REGISTRAR EVENTOS 👇 ---
  @UseGuards(ApiKeyGuard) // Protegemos esta ruta con el guardián de API Key
  @Post('events')
  logEvent(@Body() createEventDto: CreateEventDto, @Request() req) {
    // El ApiKeyGuard nos añade la información del tenant a la petición
    const tenantId = req.tenant.id;
    return this.appService.logEvent(tenantId, createEventDto);
  }

  @Post('onboarding/unified')
  unifiedOnboarding(@Body() unifiedRegisterDto: UnifiedRegisterDto) {
    return this.appService.unifiedOnboarding(unifiedRegisterDto);
  }

  @Post('invoices')
  submitInvoice(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.appService.processNewInvoice(createInvoiceDto);
  }
  @Post('jobs/:id/seal-invoice') // <-- RUTA AÑADIDA
  sealInvoice(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.appService.finalizeAndSealInvoice(id);
  }

  @Get('jobs/:id')
  getJobStatus(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.appService.findJobById(id);
  }

  @Post('jobs')
  createJob(@Body() createJobDto: CreateJobDto) {
    return this.appService.createJob(createJobDto);
  }

  @Patch('jobs/:id')
  updateJobStatus(@Param('id', new ParseUUIDPipe()) id: string, @Body() updateJobDto: UpdateJobDto) {
    return this.appService.updateJob(id, updateJobDto);
  }
  
  @UseGuards(AuthGuard)
  @Get('dashboard')
  getDashboardData(@Request() req) {
    const tenantId = req.user.tenantId; 
    return this.appService.getDashboardData(tenantId);
  }

  @Get('tenants/nif/:nif')
  async getTenantByNif(@Param('nif') nif: string) {
    const tenant = await this.appService.findTenantByNif(nif);
    return { exists: !!tenant };
  }
  
  // --- 👇 NUEVO ENDPOINT PARA GENERAR API KEYS 👇 ---
  @UseGuards(AuthGuard)
  @Post('tenants/:id/api-keys')
  generateApiKey(@Param('id', new ParseIntPipe()) id: number, @Request() req) {
    // Verificamos que el usuario que hace la petición pertenece al tenant correcto
    const userTenantId = req.user.tenantId;
    if (userTenantId !== id) {
      throw new ForbiddenException('No tienes permiso para generar claves para esta empresa.');
    }
    return this.appService.generateApiKey(id);
  }
}