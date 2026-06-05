import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Búsqueda global dentro del tenant.
   * Requiere mínimo 2 caracteres. Devuelve hasta 5 resultados por categoría.
   * Rate limit: 30 req/min — evita polling abusivo mientras el usuario escribe.
   */
  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Búsqueda global (cursos, usuarios, certificados)' })
  @ApiQuery({ name: 'q', required: true, description: 'Término de búsqueda (mín. 2 chars)' })
  search(
    @CurrentUser() user: JwtPayload,
    @Query('q') q: string = '',
  ) {
    return this.searchService.search(user.tenantId, user.sub, user.role, q);
  }
}
