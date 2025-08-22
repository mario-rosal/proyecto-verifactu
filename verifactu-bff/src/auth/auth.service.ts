// Ubicación: verifactu-bff/src/auth/auth.service.ts

import { Injectable, UnauthorizedException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { Tenant } from '../entities/tenant.entity';
import { ApiKey } from '../entities/api-key.entity'; // <-- 1. Importar ApiKey
import { RegisterDto, LoginDto } from '../dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto'; // <-- 2. Importar createHash

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(ApiKey) // <-- 3. Inyectar el repositorio de ApiKey
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly jwtService: JwtService,
  ) {}

  // --- 👇 NUEVA LÓGICA PARA VALIDAR LA API KEY 👇 ---
  async validateApiKey(apiKey: string) {
    // 1. Hashear la clave recibida para poder compararla
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    // 2. Buscar el hash en la base de datos
    const apiKeyRecord = await this.apiKeyRepository.findOne({
      where: { keyHash: keyHash, isActive: true },
      relations: ['tenant'], // Cargamos la información del tenant asociado
    });

    // 3. Si no se encuentra o no está activa, denegar acceso
    if (!apiKeyRecord) {
      throw new UnauthorizedException('API Key inválida o revocada.');
    }

    // 4. Si es válida, devolver la información del tenant
    // Esto es crucial para que n8n sepa para quién está trabajando.
    return {
      tenantId: apiKeyRecord.tenant.id,
      tenantNif: apiKeyRecord.tenant.nif,
    };
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
        tenantId: user.tenant.id 
    };
    
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  // --- 👇 NUEVA LÓGICA PARA SOLICITAR EL RESETEO 👇 ---
  async forgotPassword(email: string) {
    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      // Por seguridad, no revelamos si el usuario existe o no.
      // Simplemente devolvemos un mensaje genérico.
      return { message: 'Si tu email está registrado, recibirás un enlace para restablecer tu contraseña.' };
    }

    // 1. Generar un token seguro y aleatorio
    const token = randomBytes(32).toString('hex');
    user.passwordResetToken = token;

    // 2. Establecer una fecha de caducidad (ej. 1 hora)
    const oneHour = 60 * 60 * 1000;
    user.resetTokenExpires = new Date(Date.now() + oneHour);

    await this.userRepository.save(user);

    // 3. (Futuro) Activar el workflow de n8n para enviar el email
    // Por ahora, solo devolvemos el token para poder probarlo.
    console.log(`Token de reseteo para ${email}: ${token}`);
    
    return { message: 'Si tu email está registrado, recibirás un enlace para restablecer tu contraseña.' };
  }

  // --- 👇 NUEVA LÓGICA PARA CONFIRMAR EL RESETEO 👇 ---
  async resetPassword(token: string, newPassword: string) {
    // 1. Buscar al usuario por el token y comprobar que no ha caducado
    const user = await this.userRepository.findOne({
      where: {
        passwordResetToken: token,
        // resetTokenExpires: MoreThan(new Date()) // TypeORM puede hacer esto directamente
      },
    });

    // Comprobación manual de la fecha por simplicidad
    if (!user || user.resetTokenExpires < new Date()) {
      throw new BadRequestException('El token es inválido o ha expirado.');
    }

    // 2. Encriptar la nueva contraseña
    const salt = await bcrypt.genSalt();
    user.passwordHash = await bcrypt.hash(newPassword, salt);

    // 3. Limpiar los campos de reseteo
    user.passwordResetToken = null;
    user.resetTokenExpires = null;

    await this.userRepository.save(user);

    return { message: 'Contraseña actualizada con éxito.' };
  }
}