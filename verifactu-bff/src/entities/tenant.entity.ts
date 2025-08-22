import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('tenant')
export class Tenant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 20 })
  nif: string;

  @Column({ name: 'razon_social', length: 255 })
  razonSocial: string;

  @Column()
  modalidad: string;

  @Column({ name: 'certificados_meta', type: 'jsonb', nullable: true })
  certificadosMeta: object;
  
  @Column({ nullable: true })
  email: string;

  @Column({ name: 'contact_name', nullable: true })
  contactName: string;

  @Column({ nullable: true })
  sector: string;

  // --- 👇 NUEVO CAMPO ESTRATÉGICO 👇 ---
  @Column({ name: 'integration_method', default: 'API' })
  integrationMethod: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

