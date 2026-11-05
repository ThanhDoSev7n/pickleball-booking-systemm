import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../../../domain/value-object/user-role.vo';

/** Payload sau khi JwtAuthGuard chay xong (kq cua JwtStrategy.validate). */
export interface AuthenticatedUser {
  userId: number;
  role: UserRole;
  email: string;
}

export const CURRENT_USER_REQUEST_KEY = 'user';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (user === undefined) {
      return undefined;
    }
    return data === undefined ? user : user[data];
  },
);
