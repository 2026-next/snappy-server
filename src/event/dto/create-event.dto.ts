import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

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

  @ApiProperty({
    description: '대표 사진 MIME 타입',
    required: false,
    example: 'image/jpeg',
  })
  @IsString()
  @IsOptional()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
  thumbnailMimeType?: string;
}
