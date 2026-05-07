import {
  IsArray,
  ArrayMaxSize,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePhotoDto {
  @ApiProperty({ description: 'File Key' })
  @IsString()
  @IsNotEmpty()
  fileKey!: string;

  @ApiProperty({
    description: 'File MIME Type',
    required: false,
    example: 'image/jpeg',
  })
  @IsString()
  @IsOptional()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
  mimeType?: string;

  @ApiProperty({ description: 'File Size (bytes)', required: false })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  @IsOptional()
  fileSizeBytes?: number;

  @ApiProperty({ description: 'Image Width (px)', required: false })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  width?: number;

  @ApiProperty({ description: 'Image Height (px)', required: false })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  height?: number;

  @ApiProperty({ description: 'EXIF Taken At', required: false })
  @IsDateString()
  @IsOptional()
  exifTakenAt?: string;

  @ApiProperty({
    description: 'Image Embedding Data (Optional)',
    example: [0.1, 0.2, 0.3],
  })
  @IsArray()
  @ArrayMaxSize(4096)
  @IsNumber({}, { each: true })
  @IsOptional()
  embedding?: number[];
}
