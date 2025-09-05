import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtRotationStrategy extends PassportStrategy(Strategy, 'jwt-rotation') {
  private secret: string;
  private secretNext?: string;

  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: (request: any, rawJwtToken: any, done: (err: any, secret?: string) => void) => {
        const primary = config.get<string>('JWT_SECRET');
        const next = config.get<string>('JWT_SECRET_NEXT');
        this.secret = primary;
        this.secretNext = next;

        // Intentar con el secreto principal
        try {
          done(null, primary);
        } catch (e) {
          if (next) {
            done(null, next);
          } else {
            done(e);
          }
        }
      },
    });
  }

  async validate(payload: any) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token inválido');
    }
    return payload;
  }
}
