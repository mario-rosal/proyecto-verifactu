import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../entities/api-key.entity';
import { EventLog } from '../event-log/event-log.entity';
import { Tenant } from '../entities/tenant.entity';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(EventLog)
    private readonly eventLogRepo: Repository<EventLog>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  /** Inserta en event_log con tenant_id explícito (evita DEFAULT/null). */
  private async logConfigUpdate(tenantId: number, details: Record<string, any>) {
    await this.eventLogRepo
      .createQueryBuilder()
      .insert()
      .into(EventLog)
      .values({
        // mapeo explícito → columna tenant_id
        tenantId: Number(tenantId),
        eventType: 'CONFIG_UPDATE',
        details,
      })
      .execute();
  }

  async listKeys(tenantId: number) {
    const tId = Number(tenantId);
    if (!Number.isFinite(tId)) {
      // Sin tenant → no devolvemos nada: evitamos fuga de datos entre tenants
      throw new UnauthorizedException('Tenant no resuelto');
    }
    const keys = await this.apiKeyRepo.find({
      where: { tenant: { id: tId }, isActive: true },
      relations: ['tenant'],
      order: { createdAt: 'DESC' },
    });
    return keys.map(k => ({
      id: k.id,
      keyPrefix: k.keyPrefix,
      isActive: k.isActive,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
    }));
  }

  async createKey(tenantId: number) {
    const tId = Number(tenantId);
    if (!Number.isFinite(tId)) {
      throw new UnauthorizedException('Tenant no resuelto');
    }
    // Cargar tenant real para asegurar que TypeORM setea tenant_id
    const tenant = await this.tenantRepo.findOne({ where: { id: tId } });
    if (!tenant) {
      throw new NotFoundException('Tenant no encontrado');
    }
    const apiKey = randomBytes(24).toString('hex');
    const keyPrefix = apiKey.substring(0, 8);
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    const newKey = this.apiKeyRepo.create({
      keyHash,
      keyPrefix,
      isActive: true,
      tenant, // 👈 relación materializada
    });
    const saved = await this.apiKeyRepo.save(newKey);

    await this.logConfigUpdate(tenant.id, {
      action: 'API_KEY_CREATED',
      apiKeyId: saved.id,
      keyPrefix,
    });

    return { apiKey, id: saved.id, keyPrefix };
  }

  async revokeKey(tenantId: number, id: string) {
    const tId = Number(tenantId);
    if (!Number.isFinite(tId)) {
      throw new UnauthorizedException('Tenant no resuelto');
    }
    const key = await this.apiKeyRepo.findOne({
      where: { id, tenant: { id: tId }, isActive: true },
      relations: ['tenant'],
    });
    if (!key) throw new NotFoundException('API Key no encontrada o ya revocada');

    key.isActive = false;
    await this.apiKeyRepo.save(key);

    await this.logConfigUpdate(key.tenant.id, {
      action: 'API_KEY_REVOKED',
      apiKeyId: key.id,
      keyPrefix: key.keyPrefix,
    });

    return { revoked: true };
  }
}
