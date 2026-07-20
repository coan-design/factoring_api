import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateRecebivelDto } from './create-recebivel.dto';

export class UpdateRecebivelDto extends PartialType(
  OmitType(CreateRecebivelDto, ['tipo', 'clienteId', 'valorNominal'] as const),
) {}
