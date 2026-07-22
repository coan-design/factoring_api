import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { EnderecosModule } from './modules/enderecos/enderecos.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { RecebiveisModule } from './modules/recebiveis/recebiveis.module';
import { EmprestimosModule } from './modules/emprestimos/emprestimos.module';
import { ParcelasEmprestimoModule } from './modules/parcelas-emprestimo/parcelas-emprestimo.module';
import { NegociacoesModule } from './modules/negociacoes/negociacoes.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    AuthModule,
    UsuariosModule,
    EnderecosModule,
    ClientesModule,
    RecebiveisModule,
    EmprestimosModule,
    ParcelasEmprestimoModule,
    NegociacoesModule,
    DashboardModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
