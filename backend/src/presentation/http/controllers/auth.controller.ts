import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, UseGuards } from '@nestjs/common';
import { DomainError, DomainErrorCode } from '../../../domain/error/domain.error';
import { IUserRepository, USER_REPOSITORY } from '../../../domain/port/user.repository.port';
import { AuthResult, SafeUser, toSafeUser } from '../../../application/serialization/safe-user';
import { LoginUseCase } from '../../../application/use-case/identity/login.use-case';
import { RefreshSessionUseCase } from '../../../application/use-case/identity/refresh-session.use-case';
import { RegisterUserUseCase } from '../../../application/use-case/identity/register-user.use-case';
import { AuthenticatedUser, CurrentUser } from '../decorators/current-user.decorator';
import { LoginDto, RefreshTokenDto, RegisterDto } from '../dto/auth.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/** FR-16: dang ky / dang nhap / lam moi phien. */
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshSessionUseCase,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.registerUseCase.execute(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.loginUseCase.execute(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResult> {
    return this.refreshUseCase.execute(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<{ user: SafeUser }> {
    const found = await this.users.findById(user.userId);
    if (found === null) {
      throw new DomainError(DomainErrorCode.USER_NOT_FOUND, 'Tai khoan khong ton tai', {
        userId: user.userId,
      });
    }
    return { user: toSafeUser(found) };
  }
}
