import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateMinhaSenhaDto } from './dto/update-minha-senha.dto';
import { AuthenticatedUser } from './types/authenticated-user.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usuariosService: UsuariosService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usuariosService.findOne(user.id);
  }

  @ApiBearerAuth()
  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto) {
    return this.usuariosService.atualizarNomeProprio(user.id, dto.nome);
  }

  @ApiBearerAuth()
  @Patch('me/senha')
  updateMinhaSenha(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMinhaSenhaDto) {
    return this.usuariosService.alterarSenhaPropria(user.id, dto.senhaAtual, dto.novaSenha);
  }
}
