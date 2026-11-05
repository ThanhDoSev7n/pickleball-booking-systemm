import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Bao ve cac route can dang nhap; 401 do handleRequest cua AuthGuard nem ra. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
