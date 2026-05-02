import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post('create')
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventService.createEvent(createEventDto);
  }

  @Get('all')
  findAll() {
    return this.eventService.getCurrentEvents();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    // 3. 특정 이벤트를 가져옵니다. (여기서 +id가 아니라 그냥 id를 써야 합니다!)
    return this.eventService.findEventById(id);
  }

  // Patch(수정)와 Delete(삭제)는 지금 단계에서는 필수가 아니므로
  // 혼동을 줄이기 위해 일단 제외했습니다. 나중에 필요하면 추가
}
