import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ 
    description: '이벤트 이름', 
    example: '민준 & 지수의 결혼식' 
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ 
    description: '이벤트 날짜', 
    example: '2026-05-20T10:00:00Z' 
  })
  @IsDateString()
  @IsNotEmpty()
  eventDate: string;

  @ApiProperty({ 
    description: '주최자(User)의 ID', 
    example: '(Prisma Studio에서 확인한 ID)' 
  })
  @IsString()
  @IsNotEmpty()
  ownerId: string;
}