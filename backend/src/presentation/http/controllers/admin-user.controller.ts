import { Body, Controller, Get, HttpCode, HttpStatus, Inject, NotFoundException, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum } from 'class-validator';
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

class SetUserActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

class SetUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}

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

  @Get()
  @Roles(UserRole.ADMIN)
  async listUsers() {
    return (await this.users.listAll()).map(toSafeUser);
  }

  @Patch(':id/active')
  @Roles(UserRole.ADMIN)
  async setActive(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: SetUserActiveDto) {
    if (actor.userId === id && !dto.isActive) {
      throw new DomainError(DomainErrorCode.INVALID_INPUT, 'Không thể tự khóa tài khoản Admin đang đăng nhập');
    }
    const user = await this.users.setActive(id, dto.isActive);
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    return toSafeUser(user);
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  async setRole(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: SetUserRoleDto) {
    if (actor.userId === id && dto.role !== UserRole.ADMIN) {
      throw new DomainError(DomainErrorCode.INVALID_INPUT, 'Không thể tự hạ quyền Admin đang đăng nhập');
    }
    const user = await this.users.setRole(id, dto.role);
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    return toSafeUser(user);
  }

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
