import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OperationsService } from '../../../application/use-case/operations/operations.service';
import { AuthenticatedUser, CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../../../domain/value-object/user-role.vo';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

const OPERATIONAL_ROLES = [UserRole.STAFF, UserRole.OWNER, UserRole.ADMIN];

class CreateServiceDto {
  @IsInt() @Min(1) clusterId!: number;
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) unit!: string;
  @IsNumber() @Min(0) price!: number;
}
class UpdateServiceDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() @MinLength(1) unit?: string;
  @IsOptional() @IsNumber() @Min(0) price?: number;
}
class WalkInDto {
  @IsArray() @IsInt({ each: true }) @Min(1, { each: true }) slotIds!: number[];
  @IsInt() @Min(1) customerUserId!: number;
  @IsOptional() @IsNumber() @Min(0) expectedTotalAmount?: number;
}
class InvoiceItemDto {
  @IsInt() @Min(1) serviceId!: number;
  @IsInt() @Min(1) quantity!: number;
}
class CreateInvoiceDto {
  @IsInt() @Min(1) bookingId!: number;
  @IsEnum(['CASH', 'CARD', 'TRANSFER']) paymentMethod!: 'CASH' | 'CARD' | 'TRANSFER';
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceItemDto) items?: InvoiceItemDto[];
}
class CheckInDto { @IsString() @MinLength(1) code!: string; }

@Controller('api/operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...OPERATIONAL_ROLES)
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('services') services(@Query('clusterId') clusterId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.operations.listServices(user, clusterId ? Number(clusterId) : undefined);
  }
  @Get('clusters') clusters(@CurrentUser() user: AuthenticatedUser) {
    return this.operations.listClusters(user);
  }
  @Get('customers') customer(@Query('phone') phone: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.operations.findCustomerByPhone(user, phone ?? '');
  }
  @Get('bookings') bookings(@CurrentUser() user: AuthenticatedUser) {
    return this.operations.listBookings(user);
  }
  @Post('services') createService(@Body() dto: CreateServiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.operations.createService(user, dto);
  }
  @Patch('services/:id') updateService(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.operations.updateService(user, id, dto);
  }
  @Delete('services/:id') deactivateService(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.operations.deactivateService(user, id);
  }
  @Post('walk-in') walkIn(@Body() dto: WalkInDto, @CurrentUser() user: AuthenticatedUser) {
    return this.operations.walkIn(user, dto);
  }
  @Post('check-in') checkIn(@Body() dto: CheckInDto, @CurrentUser() user: AuthenticatedUser) {
    return this.operations.checkIn(user, dto.code);
  }
  @Post('invoices') createInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.operations.createInvoice(user, dto);
  }
  @Get('invoices/:id') invoice(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.operations.getInvoice(id, user);
  }
}
