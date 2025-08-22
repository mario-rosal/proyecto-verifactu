// ========================================================================
// EXPLICACIÓN: Esta es la versión completa de tu servicio, incluyendo
// la nueva función finalizeAndSealInvoice para la lógica de negocio crítica.
// ========================================================================
import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant } from './entities/tenant.entity';
import { Job, JobType, JobStatus } from './entities/job.entity';
import { CreateJobDto, UpdateJobDto } from './dto/job.dto';
import { InvoiceRecord } from './entities/invoice_record.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { createHash } from 'crypto';

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
    ) {}

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

    // --- NUEVA LÓGICA DE NEGOCIO CRÍTICA ---
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

        // 1. Buscar el último hash para este tenant
        const ultimoRegistro = await this.invoiceRecordRepository.findOne({
            where: { tenant: { id: tenant.id } },
            order: { createdAt: 'DESC' },
        });
        const hashAnterior = ultimoRegistro ? ultimoRegistro.hashActual : '0'.repeat(64);

        // 2. Calcular el nuevo hash
        const hashActual = this.calculateChainedHash(invoiceData, hashAnterior);

        // 3. Crear y guardar el registro final de la factura
        const nuevoRegistro = this.invoiceRecordRepository.create({
            tenant: tenant,
            tipo: invoiceData.tipo, // <-- ESTA ES LA LÍNEA QUE FALTABA
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
        this.logger.log(`Obteniendo datos del dashboard para el tenant ID: ${tenantId}`);
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

    // --- Lógica de gestión de Tenants ---
    async createTenant(tenantDto: CreateTenantDto) {
        const nuevoTenant = this.tenantRepository.create(tenantDto);
        return this.tenantRepository.save(nuevoTenant);
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