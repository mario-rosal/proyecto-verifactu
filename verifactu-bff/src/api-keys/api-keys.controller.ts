import { Controller, Get, Post, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeysService } from './api-keys.service';

@UseGuards(AuthGuard('jwt-rotation'))
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  async list(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.apiKeysService.listKeys(tenantId);
  }

  @Post()
  async create(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    return this.apiKeysService.createKey(tenantId);
  }

  @Delete(':id')
  async revoke(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId;
    return this.apiKeysService.revokeKey(tenantId, id);
  }
}
