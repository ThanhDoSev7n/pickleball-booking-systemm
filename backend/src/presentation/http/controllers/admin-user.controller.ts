import { Body, Controller, HttpCode, HttpStatus, Inject, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../../../domain/value-object/user-role.vo';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { CurrentUser, AuthenticatedUser } from '../decorators/current-user.decorator';
import { IUserRepository, USER_REPOSITORY } from '../../../domain/port/user.repository.port';
import { DomainError, DomainErrorCode } from '../../../domain/error/domain.error';
import { RegisterUserUseCase } from '../../../application/use-case/identity/register-user.use-case';
import { CreateUserDto } from '../dto/auth.dto';
import { AuthResult, toSafeUser } from '../../../application/serialization/safe-user';

/**
 * FR-16: dang ky cong khai CHI tao duoc CUSTOMER (xem RegisterUserUseCase),
 * nen viec gan STAFF/OWNER phai di qua cong quan tri co kiem tra role.
 */
@Controller('api/admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUserController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    private readonly registerUseCase: RegisterUserUseCase,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ): Promise<AuthResult> {
    const admin = await this.users.findById(actor.userId);
    if (admin === null || !admin.isAdmin()) {
      throw new DomainError(DomainErrorCode.FORBIDDEN, 'Chi Admin moi duoc phan quyen');
    }
    return this.registerUseCase.execute({ ...dto, requestedBy: admin });
  }
}

export { toSafeUser };
