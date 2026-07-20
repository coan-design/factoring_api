import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEnderecoDto } from './dto/create-endereco.dto';
import { UpdateEnderecoDto } from './dto/update-endereco.dto';

@Injectable()
export class EnderecosService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEnderecoDto) {
    return this.prisma.endereco.create({ data: dto });
  }

  findAll() {
    return this.prisma.endereco.findMany();
  }

  async findOne(id: string) {
    const endereco = await this.prisma.endereco.findUnique({ where: { id } });
    if (!endereco) {
      throw new NotFoundException('Endereco nao encontrado');
    }
    return endereco;
  }

  async update(id: string, dto: UpdateEnderecoDto) {
    await this.findOne(id);
    return this.prisma.endereco.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.endereco.delete({ where: { id } });
  }
}
