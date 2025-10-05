import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CryptoService } from '../../common/services/crypto.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../../database/entities/user.entity';
import { Challenge } from '../../database/entities/challenge.entity';
import { SecurityMetricsController } from './security-metrics.controller';
import { resolveJwtConfig } from '../../common/config/jwt.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Challenge]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const jwtConfig = resolveJwtConfig(configService);
        return {
          secret: jwtConfig.current.secret,
          signOptions: {
            algorithm: jwtConfig.algorithm,
            audience: jwtConfig.audience,
            issuer: jwtConfig.issuer,
            expiresIn: jwtConfig.expiresIn,
            keyid: jwtConfig.current.kid,
          },
        };
      },
    }),
  ],
  controllers: [AuthController, SecurityMetricsController],
  providers: [AuthService, CryptoService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
