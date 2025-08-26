import { Injectable, Logger, NotFoundException, InternalServerErrorException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Job, JobType, JobStatus } from './entities/job.entity';
import { CreateJobDto, UpdateJobDto } from './dto/job.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UnifiedRegisterDto } from './dto/auth.dto';
import { Tenant } from './entities/tenant.entity';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { InvoiceRecord } from './entities/invoice_record.entity';
import { ApiKey } from './entities/api-key.entity';
import { createHash, randomBytes  } from 'crypto';
import { EventLog } from './event-log/event-log.entity';
import { CreateEventDto } from './dto/create-event.dto'; // <-- 2. Importar DTO de Evento


@Injectable()
export class AppService {
    private readonly logger = new Logger(AppService.name);

    constructor(
        @InjectRepository(Tenant)
        private readonly tenantRepository: Repository<Tenant>,
        @InjectRepository(Job)
        private readonly jobRepository: Repository<Job>,
        @InjectRepository(InvoiceRecord)
        private readonly invoiceRecordRepository: Repository<InvoiceRecord>,
        @InjectRepository(ApiKey)
        private readonly apiKeyRepository: Repository<ApiKey>,
        @InjectRepository(EventLog)
        private readonly eventLogRepository: Repository<EventLog>,
       @InjectRepository(User)
       private readonly userRepository: Repository<User>,
       private readonly dataSource: DataSource, // Inyectamos el DataSource para manejar transacciones
    ) {}

// --- 👇 NUEVA LÓGICA PARA REGISTRAR EVENTOS (corregida) 👇 ---
async logEvent(tenantId: number, createEventDto: CreateEventDto) {
  this.logger.log(
    `Registrando evento de tipo '${createEventDto.eventType}' para el tenant ID: ${tenantId}`,
  );

  const tenant = await this.tenantRepository.findOneBy({ id: tenantId });
  if (!tenant) {
    throw new NotFoundException(`Tenant con ID ${tenantId} no encontrado al intentar registrar un evento.`);
  }

  const newEvent = this.eventLogRepository.create({
    tenantId,                              // 👈 columna tenant_id
    eventType: createEventDto.eventType,   // 👈 columna event_type
    details: createEventDto.details,       // 👈 columna details
  });

  await this.eventLogRepository.save(newEvent);
  return { status: 'evento registrado con éxito' };
}


   // --- LÓGICA DE NEGOCIO PARA EL ONBOARDING UNIFICADO Y SEGURO ---
   async unifiedOnboarding(unifiedRegisterDto: UnifiedRegisterDto) {
       this.logger.log(`Iniciando onboarding unificado para NIF: ${unifiedRegisterDto.nif}`);

       // Usamos una transacción para asegurar la integridad de los datos
       return this.dataSource.manager.transaction(async (transactionalEntityManager) => {
           // 1. Validar que el NIF no exista
           const existingTenant = await transactionalEntityManager.findOne(Tenant, { where: { nif: unifiedRegisterDto.nif } });
           if (existingTenant) {
               throw new ConflictException(`El NIF ${unifiedRegisterDto.nif} ya se encuentra registrado.`);
           }

           // 2. Validar que el Email no exista
           const existingUser = await transactionalEntityManager.findOne(User, { where: { email: unifiedRegisterDto.email } });
           if (existingUser) {
               throw new ConflictException(`El email ${unifiedRegisterDto.email} ya se encuentra registrado.`);
           }

           // 3. Crear y guardar el Tenant (la empresa)
           const newTenant = transactionalEntityManager.create(Tenant, {
               nif: unifiedRegisterDto.nif,
               razonSocial: unifiedRegisterDto.razonSocial,
               sector: unifiedRegisterDto.sector,
               modalidad: unifiedRegisterDto.modalidad,
               email: unifiedRegisterDto.email,
           });
           const savedTenant = await transactionalEntityManager.save(newTenant);

       // --- GENERACIÓN AUTOMÁTICA DE API KEY ---
     const apiKey = randomBytes(24).toString('hex');
     const keyPrefix = apiKey.substring(0, 8);
     const keyHash = createHash('sha256').update(apiKey).digest('hex');

    const newApiKey = transactionalEntityManager.create(ApiKey, {
       keyHash,
       keyPrefix,
       tenant: savedTenant,
     });
     await transactionalEntityManager.save(newApiKey);
     // -----------------------------------------

           // 4. Encriptar la contraseña del usuario
           const salt = await bcrypt.genSalt();
           const passwordHash = await bcrypt.hash(unifiedRegisterDto.password, salt);

           // 5. Crear y guardar el User, asociándolo al Tenant recién creado
           const newUser = transactionalEntityManager.create(User, {
               email: unifiedRegisterDto.email,
               passwordHash,
               firstName: unifiedRegisterDto.firstName,
               lastName: unifiedRegisterDto.lastName,
               tenant: savedTenant,
               role: UserRole.ADMIN,
           });
           const savedUser = await transactionalEntityManager.save(newUser);
           
           this.logger.log(`Onboarding completado para ${savedTenant.razonSocial}. Usuario admin ${savedUser.email} creado.`);
           
           const { passwordHash: _, ...userWithoutPassword } = savedUser;
           return userWithoutPassword;
       });
   }

    // --- LÓGICA PARA PROCESAR FACTURAS ENTRANTES ---
    async processNewInvoice(createInvoiceDto: CreateInvoiceDto) {
        this.logger.log(`Recibida nueva factura del emisor: ${createInvoiceDto.emisorNif}`);

        const tenant = await this.findTenantByNif(createInvoiceDto.emisorNif);
        if (!tenant) {
            throw new NotFoundException(`El emisor con NIF ${createInvoiceDto.emisorNif} no es un cliente registrado.`);
        }

        const newJob = this.jobRepository.create({
            type: JobType.INVOICE_SUBMISSION,
            payload: createInvoiceDto,
            status: JobStatus.PENDING,
        });

        const savedJob = await this.jobRepository.save(newJob);
        this.logger.log(`Creado Job ${savedJob.id} para procesar la factura.`);
        
        return { jobId: savedJob.id };
    }

// --- NUEVA LÓGICA PARA GENERAR API KEYS ---
 async generateApiKey(tenantId: number): Promise<{ apiKey: string }> {
   this.logger.log(`Generando nueva API Key para el tenant ID: ${tenantId}`);
   
   const tenant = await this.tenantRepository.findOneBy({ id: tenantId });
   if (!tenant) {
     throw new NotFoundException(`La empresa con ID ${tenantId} no existe.`);
   }

   // 1. Generar una clave aleatoria y segura
   const apiKey = randomBytes(24).toString('hex');
   const keyPrefix = apiKey.substring(0, 8);

   // 2. Hashear la clave para un almacenamiento seguro
   const keyHash = createHash('sha256').update(apiKey).digest('hex');

   // 3. Crear y guardar la nueva entidad ApiKey
   const newApiKey = this.apiKeyRepository.create({
     keyHash,
     keyPrefix,
     tenant,
   });
   await this.apiKeyRepository.save(newApiKey);

   // 4. Devolver la clave en texto plano ESTA ÚNICA VEZ.
   return { apiKey };
 }
    // --- LÓGICA DE NEGOCIO CRÍTICA ---
    async finalizeAndSealInvoice(jobId: string): Promise<InvoiceRecord> {
        this.logger.log(`Iniciando sellado de factura para el Job ID: ${jobId}`);
        const job = await this.findJobById(jobId);
        if (!job || !job.payload) {
            throw new InternalServerErrorException(`No se encontraron datos en el trabajo ${jobId}`);
        }

        try {
            const dto = job.payload as CreateInvoiceDto;

            // Validaciones mínimas de campos requeridos
            if (!dto.emisorNif) throw new BadRequestException('Falta emisorNif');
            if (!dto.serie) throw new BadRequestException('Falta serie');
            if (!dto.numero) throw new BadRequestException('Falta numero');
            if (!dto.fechaEmision) throw new BadRequestException('Falta fechaEmision');
            if (!dto.totales) throw new BadRequestException('Faltan totales');
            if (!dto.receptor?.idFiscal) throw new BadRequestException('Falta receptor.idFiscal');

            const tenant = await this.findTenantByNif(dto.emisorNif);
            if (!tenant) {
                throw new NotFoundException(`Tenant no encontrado para el emisor ${dto.emisorNif}`);
            }

            // Coerción/normalización de números (evita .toFixed sobre string/undefined)
            const base  = this.coerceNumber((dto as any).totales?.base,  'totales.base');
            const iva   = this.coerceNumber((dto as any).totales?.iva,   'totales.iva');
            const total = this.coerceNumber((dto as any).totales?.total, 'totales.total');

            const ultimoRegistro = await this.invoiceRecordRepository.findOne({
                where: { tenant: { id: tenant.id } },
                order: { createdAt: 'DESC' },
            });
            const hashAnterior = ultimoRegistro ? ultimoRegistro.hashActual : '0'.repeat(64);

            // Solo usamos los campos necesarios para el hash, ya normalizados
            const dtoParaHash = {
                emisorNif: dto.emisorNif,
                serie: dto.serie,
                numero: dto.numero,
                fechaEmision: dto.fechaEmision,
                totales: { base, iva, total },
            } as unknown as CreateInvoiceDto;
            const hashActual = this.calculateChainedHash(dtoParaHash, hashAnterior);

            const nuevoRegistro = this.invoiceRecordRepository.create({
                tenant,
                tipo: dto.tipo,
                serie: dto.serie,
                numero: dto.numero,
                fechaEmision: dto.fechaEmision,
                emisorNif: dto.emisorNif,
                receptorNif: dto.receptor.idFiscal,
                baseTotal: base,
                cuotaTotal: iva,
                importeTotal: total,
                desgloseIva: dto.lineas,
                hashActual,
                hashAnterior,
                estadoAeat: 'PENDING',
            });

            const savedRecord = await this.invoiceRecordRepository.save(nuevoRegistro);

            // Actualizar estado del Job a COMPLETED con resultado útil
            await this.updateJob(jobId, {
                status: JobStatus.COMPLETED as any,
                result: { invoiceRecordId: savedRecord.id, hashActual },
            } as UpdateJobDto);

            this.logger.log(`Factura ${savedRecord.id} sellada y guardada con éxito.`);
            return savedRecord;
        } catch (err: any) {
            // Best-effort: marcar el Job como FAILED
            try {
                await this.updateJob(jobId, {
                    status: JobStatus.FAILED as any,
                    errorMessage: err?.message ?? 'Error al finalizar y sellar la factura',
                } as UpdateJobDto);
            } catch (e: any) {
                this.logger.error(`No se pudo actualizar el estado del Job ${jobId} a FAILED: ${e?.message}`);
            }
            throw err;
        }
    }

    // --- Lógica de gestión de Dashboard ---
    async getDashboardData(tenantId: number) {
        const tenant = await this.tenantRepository.findOneBy({ id: tenantId });
        if (!tenant) {
            throw new NotFoundException(`Tenant con ID ${tenantId} no encontrado.`);
        }
        const [invoices, invoiceCount] = await this.invoiceRecordRepository.findAndCount({
            where: { tenant: { id: tenantId } },
            order: { createdAt: 'DESC' },
            take: 10,
        });
        return { tenant, invoiceCount, invoices };
    }

    // --- Lógica de gestión de Jobs ---
    async createJob(createJobDto: CreateJobDto): Promise<Job> {
        const newJob = this.jobRepository.create({
            type: createJobDto.type as JobType,
            payload: createJobDto.payload,
            status: JobStatus.PENDING,
        });
        return this.jobRepository.save(newJob);
    }

    async findJobById(id: string): Promise<Job> {
        const job = await this.jobRepository.findOneBy({ id });
        if (!job) {
            throw new NotFoundException(`Trabajo con ID ${id} no encontrado.`);
        }
        return job;
    }

    async updateJob(id: string, updateJobDto: UpdateJobDto): Promise<Job> {
        const job = await this.findJobById(id);
        job.status = updateJobDto.status as JobStatus;
        if (updateJobDto.result) job.result = updateJobDto.result;
        if (updateJobDto.errorMessage) job.errorMessage = updateJobDto.errorMessage;
        return this.jobRepository.save(job);
    }

    async findTenantByNif(nif: string): Promise<Tenant | null> {
        return this.tenantRepository.findOne({ where: { nif } });
    }

    // Coerción robusta de numéricos (admite strings y coma decimal)
    private coerceNumber(value: any, fieldName: string): number {
        if (typeof value === 'string') {
            value = value.trim().replace(',', '.');
        }
        const num = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(num)) {
            throw new BadRequestException(`Campo numérico inválido: ${fieldName}`);
        }
        return num;
    }

    // --- Función Auxiliar para Calcular Hash ---
    private calculateChainedHash(record: CreateInvoiceDto, prevHash: string): string {
        const version = '1';
        const baseString = [
            version,
            record.emisorNif,
            record.serie,
            record.numero,
            record.fechaEmision,
            record.totales.base.toFixed(2),
            record.totales.iva.toFixed(2),
            record.totales.total.toFixed(2)
        ].join('|');
        const fullString = `${baseString}|${prevHash}`;
        return createHash('sha256').update(fullString).digest('hex').toUpperCase();
    }
}