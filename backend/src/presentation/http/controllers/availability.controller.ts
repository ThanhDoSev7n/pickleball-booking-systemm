import { Controller, Get, Query } from '@nestjs/common';
import { toDateString } from '../../../domain/model/booking-slot.entity';
import {
  AvailabilityInput,
  CourtAvailabilityView,
  SearchAvailabilityUseCase,
} from '../../../application/use-case/booking/search-availability.use-case';
import { AvailabilityQueryDto } from '../dto/availability.dto';

/** FR-01: cong khai, khong can dang nhap. */
@Controller('api/availability')
export class AvailabilityController {
  constructor(private readonly searchUseCase: SearchAvailabilityUseCase) {}

  @Get()
  async find(@Query() query: AvailabilityQueryDto): Promise<AvailabilityResponse> {
    const date = query.date ?? toDateString(new Date());
    const courts = await this.searchUseCase.execute({ ...query, date });
    return { date, courts };
  }
}

/** Frontend (Thanh vien 1 - Next.js) ky vong shape co dong `date` de hien tieu de va echo lai. */
interface AvailabilityResponse {
  date: string;
  courts: CourtAvailabilityView[];
}
