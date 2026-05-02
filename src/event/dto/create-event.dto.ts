import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateEventDto {
  @ApiProperty({
    description: '이벤트 이름',
    example: '민준 & 지수의 결혼식',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: '이벤트 날짜',
    example: '2026-05-20T10:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  eventDate!: string;

  // ownerId는 이벤트 생성 시 서버에서 자동으로 할당됨.
}
