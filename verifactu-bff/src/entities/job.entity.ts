import { 
    Entity, 
    PrimaryGeneratedColumn, 
    Column, 
    CreateDateColumn, 
    UpdateDateColumn 
} from 'typeorm';

// Replicamos los ENUMs que creamos en la base de datos para usarlos en nuestro código
export enum JobStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

// --- 👇 AÑADIMOS EL NUEVO TIPO DE TRABAJO 👇 ---
export enum JobType {
    TENANT_ONBOARDING = 'TENANT_ONBOARDING',
    INVOICE_SUBMISSION = 'INVOICE_SUBMISSION',
}

@Entity('jobs')
export class Job {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: JobType,
    })
    type: JobType;

    @Column({
        type: 'enum',
        enum: JobStatus,
        default: JobStatus.PENDING,
    })
    status: JobStatus;

    @Column({ type: 'jsonb', nullable: true })
    payload: object;

    @Column({ type: 'jsonb', nullable: true })
    result: object;

    @Column({ name: 'error_message', type: 'text', nullable: true })
    errorMessage: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
