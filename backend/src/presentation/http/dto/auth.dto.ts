import { IsEmail, IsEnum, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../../../domain/value-object/user-role.vo';

/** VN mobile: 0xxxxxxxxx | 8xxxxxxxxx | +84xxxxxxxxx (domain normalizePhone cung chuan hoa vay). */
const VIETNAM_PHONE_PATTERN = /^(?:\+84|84|0)(?:3|5|7|8|9)\d{8}$/;

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'Ho ten khong duoc de trong' })
  @MaxLength(120, { message: 'Ho ten toi da 120 ky tu' })
  fullName!: string;

  @IsEmail({}, { message: 'Email khong hop le' })
  @MaxLength(160, { message: 'Email toi da 160 ky tu' })
  email!: string;

  @Matches(VIETNAM_PHONE_PATTERN, { message: 'So dien thoai khong hop le (VD: 0901234567)' })
  phoneNumber!: string;

  @IsString()
  @MinLength(8, { message: 'Mat khau toi thieu 8 ky tu' })
  @MaxLength(72, { message: 'Mat khau toi da 72 ky tu (bcrypt)' })
  password!: string;
}

/**
 * RegisterDto khong co cot `role`: ValidationPipe whitelist:true se nen bo toan field
 * khong khai bao, nen dang ky cong khai khong the tu nang quyen.
 * Route quan tri dung DTO rieng co khai bao `role` de cap STAFF/OWNER (FR-16).
 */
export class CreateUserDto extends RegisterDto {
  @IsEnum(UserRole, { message: 'Role khong hop le (CUSTOMER | STAFF | OWNER | ADMIN)' })
  role!: UserRole;
}

export class LoginDto {
  @IsEmail({}, { message: 'Email khong hop le' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Mat khau khong duoc de trong' })
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'refreshToken khong duoc de trong' })
  refreshToken!: string;
}
