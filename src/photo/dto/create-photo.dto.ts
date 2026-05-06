import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePhotoDto {
  @ApiProperty({ description: '이벤트 ID' })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({ description: 'GCS에 업로드된 파일 경로(Key)' })
  @IsString()
  @IsNotEmpty()
  fileKey: string;

  @ApiProperty({ description: '이미지 임베딩 데이터 (선택)', example: [0.1, 0.2, 0.3 ]})
  @IsArray()
  @IsOptional()
  embedding?: number[];
}