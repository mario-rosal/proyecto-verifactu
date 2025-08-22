// Ubicación: verifactu-bff/src/entities/user.entity.ts

import { 
    Entity, 
    PrimaryGeneratedColumn, 
    Column, 
    CreateDateColumn, 
    UpdateDateColumn,
    ManyToOne,
    JoinColumn
} from 'typeorm';
import { Tenant } from './tenant.entity';

// Replicamos el ENUM de la base de datos para usarlo en el código
export enum UserRole {
    ADMIN = 'ADMIN',
    MEMBER = 'MEMBER',
    AUDITOR = 'AUDITOR',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column({ name: 'password_hash' })
    passwordHash: string;

    @Column({ name: 'first_name', nullable: true })
    firstName: string;

    @Column({ name: 'last_name', nullable: true })
    lastName: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.MEMBER,
    })
    role: UserRole;

    @Column({ name: 'is_active', default: true })
    isActive: boolean;

    // --- 👇 NUEVOS CAMPOS PARA RECUPERACIÓN DE CONTRASEÑA 👇 ---
    @Column({ name: 'password_reset_token', type: 'varchar', length: 255, unique: true, nullable: true })
    passwordResetToken: string;

    @Column({ name: 'reset_token_expires', type: 'timestamptz', nullable: true })
    resetTokenExpires: Date;
    // ---------------------------------------------------------

    // --- Relación con Tenant ---
    @ManyToOne(() => Tenant, { nullable: false })
    @JoinColumn({ name: 'tenant_id' })
    tenant: Tenant;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}

