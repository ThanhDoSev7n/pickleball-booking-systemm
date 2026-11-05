import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PASSWORD_HASHER } from '../domain/port/password-hasher.port';
import { TOKEN_ISSUER } from '../domain/port/token-issuer.port';
import { USER_REPOSITORY } from '../domain/port/user.repository.port';
import { RegisterUserUseCase } from '../application/use-case/identity/register-user.use-case';
import { LoginUseCase } from '../application/use-case/identity/login.use-case';
import { RefreshSessionUseCase } from '../application/use-case/identity/refresh-session.use-case';
import { TypeOrmUserRepository } from '../infrastructure/persistence/typeorm/repositories/user.repository';
import { UserSchema } from '../infrastructure/persistence/typeorm/entities/user.schema';
import { BcryptPasswordHasher } from '../infrastructure/security/bcrypt-hasher';
import { JwtTokenIssuer } from '../infrastructure/security/jwt-token.issuer';
import { AuthController } from '../presentation/http/controllers/auth.controller';
import { AdminUserController } from '../presentation/http/controllers/admin-user.controller';
import { JwtAuthGuard } from '../presentation/http/guards/jwt-auth.guard';
import { RolesGuard } from '../presentation/http/guards/roles.guard';
import { JwtStrategy } from '../presentation/http/strategies/jwt.strategy';

/** Identity Context: tai khoan, RBAC, JWT. */
@Module({
  imports: [
    TypeOrmModule.forFeature([UserSchema]),
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      // TTL duoc tinh theo tung token trong JwtTokenIssuer nen khong dat o day.
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
    RegisterUserUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  controllers: [AuthController, AdminUserController],
  exports: [
    USER_REPOSITORY,
    TOKEN_ISSUER,
    PASSWORD_HASHER,
    RegisterUserUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class IdentityModule {}
