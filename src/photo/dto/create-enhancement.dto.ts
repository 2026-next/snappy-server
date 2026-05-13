import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEnhancementDto {
  @ApiProperty({
    description: 'AI 보정 prompt (자유 텍스트)',
    example: '배경에 화사한 꽃들을 자연스럽게 추가해줘',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  prompt!: string;
}
