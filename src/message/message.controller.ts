import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UpdateMessageDto } from './dto/update-message.dto';

import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request-types';

@ApiTags('Message') // Swagger 카테고리 설정
@Controller('message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  @ApiOperation({ summary: '축하 메시지 작성' })
  create(@Body() createMessageDto: CreateMessageDto) {
    return this.messageService.create(createMessageDto);
  }

  @Get()
  @ApiOperation({ summary: '특정 이벤트의 모든 메시지 조회' })
  findAll(@Query('eventId') eventId: string) {
    return this.messageService.findAllByEvent(eventId);
  }

  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth('access-token')
  @Patch(':id')
  @ApiOperation({ summary: '축하 메시지 수정' })
  update(
    @Param('id') id: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    // 임시로 테스트를 위해 특정 guestId를 넣거나,
    // Auth 기능이 완성되면 거기서 ID를 받아오도록 연결해야 합니다.
    const guestId = req.user.sub; //'sub'이 하객의 ID
    return this.messageService.update(id, updateMessageDto, guestId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '메시지 삭제' })
  remove(@Param('id') id: string) {
    return this.messageService.remove(id);
  }
}
