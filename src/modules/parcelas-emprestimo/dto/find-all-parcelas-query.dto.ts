import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FindAllParcelasQueryDto extends PaginationQueryDto {
  @ApiProperty()
  @IsUUID()
  emprestimoId: string;
}
