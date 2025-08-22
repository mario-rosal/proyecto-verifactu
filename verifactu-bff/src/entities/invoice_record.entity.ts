import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('invoice_record')
@Unique(['tenant', 'serie', 'numero'])
export class InvoiceRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'hash_actual', type: 'varchar', length: 64 })
  hashActual: string;

  @Column({ name: 'hash_anterior', type: 'varchar', length: 64, nullable: true })
  hashAnterior: string;

  @Column({ type: 'varchar', length: 20 })
  tipo: 'ALTA' | 'ANULACION';

  @Column({ type: 'varchar', length: 50 })
  serie: string;

  @Column({ type: 'varchar', length: 50 })
  numero: string;

  @Column({ name: 'fecha_emision', type: 'date' })
  fechaEmision: string;

  @Column({ name: 'emisor_nif', type: 'varchar', length: 20 })
  emisorNif: string;

  @Column({ name: 'receptor_nif', type: 'varchar', length: 20, nullable: true })
  receptorNif: string;

  @Column({ name: 'base_total', type: 'decimal', precision: 12, scale: 2, transformer: { from: (value: string) => parseFloat(value), to: (value: number) => value } })
  baseTotal: number;

  @Column({ name: 'cuota_total', type: 'decimal', precision: 12, scale: 2, transformer: { from: (value: string) => parseFloat(value), to: (value: number) => value } })
  cuotaTotal: number;

  @Column({ name: 'importe_total', type: 'decimal', precision: 12, scale: 2, transformer: { from: (value: string) => parseFloat(value), to: (value: number) => value } })
  importeTotal: number;

  @Column({ name: 'desglose_iva', type: 'jsonb', nullable: true })
  desgloseIva: any;

  @Column({ name: 'estado_aeat', type: 'varchar', length: 50, default: 'PENDIENTE' })
  estadoAeat: string;

  @Column({ name: 'aeat_request_id', type: 'varchar', length: 100, nullable: true })
  aeatRequestId: string;

  @Column({ name: 'respuesta_aeat', type: 'text', nullable: true })
  respuestaAeat: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
