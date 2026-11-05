import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../domain/value-object/user-role.vo';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/** RBAC lop 1 o tang presentation (muc 4.7.3); cac lop kiem tra sau nam trong use case. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Endpoint khong khai bao roles thi mac dinh phai co JWT hop le.
    if (required === undefined || required.length === 0) {
      return true;
    }
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (user === undefined) {
      throw new UnauthorizedException('Chua dang nhap');
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException('Tai khoan khong du quyen thuc hien thao tac nay');
    }
    return true;
  }
}
