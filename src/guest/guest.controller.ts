import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GuestService } from './guest.service';
import { CheckGuestNameDto } from './dto/check-name.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request-types';

@ApiTags('Guest')
@Controller('guest')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @ApiOperation({ summary: 'Check whether guest name is available' })
  @ApiBody({ type: CheckGuestNameDto })
  @ApiOkResponse({ description: 'Name availability returned' })
  @Post('check-name')
  checkName(@Body() checkGuestNameDto: CheckGuestNameDto) {
    return this.guestService.checkNameExists(checkGuestNameDto);
  }
}
