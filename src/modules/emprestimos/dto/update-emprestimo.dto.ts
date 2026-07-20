import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateEmprestimoDto } from './create-emprestimo.dto';

export class UpdateEmprestimoDto extends PartialType(
  OmitType(CreateEmprestimoDto, ['clienteId'] as const),
) {}
