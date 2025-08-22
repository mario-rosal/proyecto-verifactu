import { Injectable, Logger, NotFoundException, InternalServerErrorException, ConflictException } from '@nestjs/common';
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
import { EventLog, EventType } from './entities/event-log.entity'; // <-- 1. Importar EventLog
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
       @InjectRepository(User)
       private readonly userRepository: Repository<User>,
       private readonly dataSource: DataSource, // Inyectamos el DataSource para manejar transacciones
    ) {}

    // --- 👇 NUEVA LÓGICA PARA REGISTRAR EVENTOS 👇 ---
  async logEvent(tenantId: number, createEventDto: CreateEventDto) {
    this.logger.log(`Registrando evento de tipo '${createEventDto.eventType}' para el tenant ID: ${tenantId}`);
    
    const tenant = await this.tenantRepository.findOneBy({ id: tenantId });
    if (!tenant) {
      // Este error no debería ocurrir si el ApiKeyGuard funciona, pero es una buena práctica
      throw new NotFoundException(`Tenant con ID ${tenantId} no encontrado al intentar registrar un evento.`);
    }

    const newEvent = this.eventLogRepository.create({
      tenant: tenant,
      eventType: createEventDto.eventType,
      details: createEventDto.details,
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

        const invoiceData = job.payload as CreateInvoiceDto;
        const tenant = await this.findTenantByNif(invoiceData.emisorNif);
        if (!tenant) {
            throw new NotFoundException(`Tenant no encontrado para el emisor ${invoiceData.emisorNif}`);
        }

        const ultimoRegistro = await this.invoiceRecordRepository.findOne({
            where: { tenant: { id: tenant.id } },
            order: { createdAt: 'DESC' },
        });
        const hashAnterior = ultimoRegistro ? ultimoRegistro.hashActual : '0'.repeat(64);

        const hashActual = this.calculateChainedHash(invoiceData, hashAnterior);

        const nuevoRegistro = this.invoiceRecordRepository.create({
            tenant: tenant,
            tipo: invoiceData.tipo,
            serie: invoiceData.serie,
            numero: invoiceData.numero,
            fechaEmision: invoiceData.fechaEmision,
            emisorNif: invoiceData.emisorNif,
            receptorNif: invoiceData.receptor.idFiscal,
            baseTotal: invoiceData.totales.base,
            cuotaTotal: invoiceData.totales.iva,
            importeTotal: invoiceData.totales.total,
            desgloseIva: invoiceData.lineas,
            hashActual: hashActual,
            hashAnterior: hashAnterior,
            estadoAeat: 'PENDING',
        });

        const savedRecord = await this.invoiceRecordRepository.save(nuevoRegistro);
        this.logger.log(`Factura ${savedRecord.id} sellada y guardada con éxito.`);
        return savedRecord;
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
