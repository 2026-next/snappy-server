import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ description: '축하 메시지 내용' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: '작성자 이름' })
  @IsString()
  @IsNotEmpty()
  authorName: string;

  @ApiProperty({ description: '이벤트 ID' })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({ description: '하객 ID (선택)', required: false })
  @IsString()
  @IsOptional()
  authorGuestId?: string;
}
