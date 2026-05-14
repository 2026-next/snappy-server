import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUploadUrlsDto {
  @ApiProperty({ description: 'File Count to Upload', minimum: 1, maximum: 200 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  fileCount!: number;

  @ApiProperty({
    description: 'File MIME Type to Upload',
    example: 'image/jpeg',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
  mimeType!: string;
}
