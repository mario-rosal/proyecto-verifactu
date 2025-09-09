// Ubicación: verifactu-bff/src/auth/auth.service.ts

import { Injectable, UnauthorizedException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Tenant } from '../entities/tenant.entity';
import { ApiKey } from '../entities/api-key.entity'; // <-- solo ApiKey; ya no usamos ApiKeyType
import { RegisterDto, LoginDto } from '../dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly jwtService: JwtService,
  ) {}

  // --- 👇 LÓGICA MEJORADA PARA VALIDAR LA API KEY 👇 ---
  async validateApiKey(apiKey: string): Promise<{ tenantId: string; tenantNif: string }> {
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const apiKeyRecord = await this.apiKeyRepository.findOne({
      where: { keyHash, isActive: true },
      relations: ['tenant'],
    });

    if (!apiKeyRecord) {
      throw new UnauthorizedException('API Key inválida o revocada.');
    }

    // (sin expiración por columna inexistente en BD)
    
    // Actualizar la fecha de último uso (opcional, bueno para auditoría)
    this.apiKeyRepository.update(apiKeyRecord.id, { lastUsedAt: new Date() });

    return {
      tenantId: String(apiKeyRecord.tenant.id),
      tenantNif: apiKeyRecord.tenant.nif,
    };
  }

  // --- 👇 NUEVO MÉTODO PRIVADO PARA GENERAR API KEYS TEMPORALES 👇 ---
  private async _generateAndSaveTemporaryApiKey(tenant: Tenant): Promise<string> {
    const newApiKey = randomBytes(24).toString('hex');
    const keyPrefix = newApiKey.substring(0, 8);
    const keyHash = createHash('sha256').update(newApiKey).digest('hex');
    
    const apiKeyEntity = this.apiKeyRepository.create({
      keyHash,
      keyPrefix,
      tenant,
      isActive: true,
    });

    await this.apiKeyRepository.save(apiKeyEntity);

    return newApiKey;
  }

  async register(registerDto: RegisterDto) {
    const tenant = await this.tenantRepository.findOneBy({ id: registerDto.tenantId });
    if (!tenant) {
      throw new NotFoundException(`La empresa con ID ${registerDto.tenantId} no existe.`);
    }

    const existingUser = await this.userRepository.findOneBy({ email: registerDto.email });
    if (existingUser) {
        throw new ConflictException('El email ya está registrado.');
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(registerDto.password, salt);

    const newUser = this.userRepository.create({
      ...registerDto,
      passwordHash,
      tenant,
      role: UserRole.ADMIN,
    });

    const savedUser = await this.userRepository.save(newUser);
    
    const { passwordHash: _, ...userWithoutPassword } = savedUser;
    return userWithoutPassword;
  }

  async login(loginDto: LoginDto) {
    const user = await this.userRepository.findOne({
        where: { email: loginDto.email },
        relations: ['tenant'],
    });
    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    const isPasswordMatching = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordMatching) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant.id,
    };
    // No crear API Key en login: solo JWT. Las API Keys se gestionan desde /v1/api-keys (dashboard).
    return {
      access_token: await this.jwtService.signAsync(payload),
      api_key: null,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      return { message: 'Si tu email está registrado, recibirás un enlace para restablecer tu contraseña.' };
    }

    const token = randomBytes(32).toString('hex');
    user.passwordResetToken = token;

    const oneHour = 60 * 60 * 1000;
    user.resetTokenExpires = new Date(Date.now() + oneHour);

    await this.userRepository.save(user);

    console.log(`Token de reseteo para ${email}: ${token}`);
    
    return { message: 'Si tu email está registrado, recibirás un enlace para restablecer tu contraseña.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userRepository.findOne({
      where: {
        passwordResetToken: token,
      },
    });

    if (!user || user.resetTokenExpires < new Date()) {
      throw new BadRequestException('El token es inválido o ha expirado.');
    }

    const salt = await bcrypt.genSalt();
    user.passwordHash = await bcrypt.hash(newPassword, salt);

    user.passwordResetToken = null;
    user.resetTokenExpires = null;

    await this.userRepository.save(user);

    return { message: 'Contraseña actualizada con éxito.' };
  }
}
