import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export class ReplacePhotoFileDto {
  @ApiProperty({
    description:
      'New storage object key returned by an earlier signed-URL upload. ' +
      "Must live under the target photo's event prefix " +
      '(`events/{photo.eventId}/...`) so callers cannot point at another event.',
    example: 'events/event-uuid/edits/new-photo-uuid',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  fileKey!: string;

  @ApiProperty({
    description: 'MIME type of the newly uploaded bytes.',
    enum: SUPPORTED_MIME_TYPES,
    example: 'image/jpeg',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(SUPPORTED_MIME_TYPES)
  mimeType!: string;

  @ApiPropertyOptional({
    description:
      'File size in bytes. Server stores `null` when omitted; clients may ' +
      'omit when the byte size has not been measured.',
    minimum: 0,
    maximum: 100_000_000,
    example: 2_048_000,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  @IsOptional()
  fileSizeBytes?: number;

  @ApiPropertyOptional({
    description: 'Image width in pixels of the new file.',
    minimum: 0,
    example: 1920,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  width?: number;

  @ApiPropertyOptional({
    description: 'Image height in pixels of the new file.',
    minimum: 0,
    example: 1080,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  height?: number;
}
