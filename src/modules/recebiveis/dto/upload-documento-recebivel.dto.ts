import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum LadoDocumentoRecebivel {
  FRENTE = 'FRENTE',
  VERSO = 'VERSO',
}

export class UploadDocumentoRecebivelDto {
  @ApiProperty({ enum: LadoDocumentoRecebivel })
  @IsEnum(LadoDocumentoRecebivel)
  lado: LadoDocumentoRecebivel;
}
