import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GuestService } from './guest.service';
import { CheckGuestNameDto } from './dto/check-name.dto';

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
