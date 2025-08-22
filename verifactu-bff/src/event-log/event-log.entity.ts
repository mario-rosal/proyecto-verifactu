import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'event_log' }) // 👈 coincide con tu tabla real
export class EventLog {
  @PrimaryGeneratedColumn({ type: 'int' })
  id!: number;

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId!: number;

  // Si en tu DB "event_type" es un enum propio, de momento lo tratamos como texto para no liarla
  @Column({ name: 'event_type', type: 'varchar', length: 64 })
  eventType!: string;

  @Column({ name: 'details', type: 'jsonb', nullable: true })
  details?: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
