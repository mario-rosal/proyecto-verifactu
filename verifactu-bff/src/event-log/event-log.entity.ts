import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'event_logs' })
export class EventLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Guardamos el identificador del tenant como string (puedes cambiar a number si prefieres)
  @Column({ type: 'varchar', length: 128 })
  tenant!: string;

  @Column({ type: 'varchar', length: 64 })
  eventType!: string;

  // Detalles del evento (payload libre)
  @Column({ type: 'jsonb', nullable: true })
  details?: unknown;

  @CreateDateColumn()
  createdAt!: Date;
}
