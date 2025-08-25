import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn
} from 'typeorm';
import { Tenant } from './tenant.entity';



@Entity('api_keys')
export class ApiKey {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'key_hash', unique: true })
    keyHash: string;

    @Column({ name: 'key_prefix', length: 8 })
    keyPrefix: string;

    @Column({ default: true, name: 'is_active' })
    isActive: boolean;

    

        // ⚠️ La tabla actual NO tiene 'expires_at'. Quitamos el mapeo para no romper SELECT/INSERT.
    // Si en el futuro agregamos la columna, reintroducimos este campo con la migración correspondiente.

    @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
    lastUsedAt: Date;

    @ManyToOne(() => Tenant, { nullable: false })
    @JoinColumn({ name: 'tenant_id' })
    tenant: Tenant;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}