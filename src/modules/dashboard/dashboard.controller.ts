import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { IndicadoresDashboardDto } from './dto/indicadores-dashboard.dto';
import { RecebivelPorStatusDto } from './dto/recebivel-por-status.dto';
import { ReceitaMensalDto } from './dto/receita-mensal.dto';
import { FindReceitaMensalQueryDto } from './dto/find-receita-mensal-query.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('indicadores')
  @ApiOkResponse({ type: IndicadoresDashboardDto })
  getIndicadores(): Promise<IndicadoresDashboardDto> {
    return this.dashboardService.getIndicadores();
  }

  @Get('recebiveis-por-status')
  @ApiOkResponse({ type: [RecebivelPorStatusDto] })
  getRecebiveisPorStatus(): Promise<RecebivelPorStatusDto[]> {
    return this.dashboardService.getRecebiveisPorStatus();
  }

  @Get('receita-mensal')
  @ApiOkResponse({ type: [ReceitaMensalDto] })
  @ApiQuery({ name: 'meses', required: false, type: Number })
  getReceitaMensal(@Query() query: FindReceitaMensalQueryDto): Promise<ReceitaMensalDto[]> {
    return this.dashboardService.getReceitaMensal(query.meses);
  }
}
