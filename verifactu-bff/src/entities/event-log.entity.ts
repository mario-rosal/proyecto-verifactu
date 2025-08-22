import { 
    Entity, 
    PrimaryGeneratedColumn, 
    Column, 
    CreateDateColumn,
    ManyToOne,
    JoinColumn
} from 'typeorm';
import { Tenant } from './tenant.entity';

// Replicamos el ENUM de la base de datos para usarlo en el código
export enum EventType {
    APP_START = 'APP_START', 
    APP_SHUTDOWN = 'APP_SHUTDOWN', 
    CONFIG_UPDATE = 'CONFIG_UPDATE',
    COMMUNICATION_ERROR = 'COMMUNICATION_ERROR',
    VERSION_UPDATE = 'VERSION_UPDATE'
}

@Entity('event_log')
export class EventLog {
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: number;

    @ManyToOne(() => Tenant, { nullable: false })
    @JoinColumn({ name: 'tenant_id' })
    tenant: Tenant;

    @Column({
        type: 'enum',
        enum: EventType,
        name: 'event_type',
    })
    eventType: EventType;

    @Column({ type: 'jsonb', nullable: true })
    details: object;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}