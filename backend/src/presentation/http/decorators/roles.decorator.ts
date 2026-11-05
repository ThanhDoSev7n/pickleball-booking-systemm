import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../domain/value-object/user-role.vo';

export const ROLES_KEY = 'roles';

/** Gan role duoc phep vao metadata cua handler/endpoint - RolesGuard doc lai. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
