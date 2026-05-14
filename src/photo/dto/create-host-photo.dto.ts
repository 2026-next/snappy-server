import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHostPhotoDto {
  @ApiProperty({
    description: 'ID of the event the host owns',
    example: 'cmoohra6a000115zyl8cnomj2',
  })
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @ApiProperty({
    description:
      'Storage object key returned by `POST /photo/host/upload-url`. ' +
      'Must live under `events/{eventId}/...` for the target event.',
  })
  @IsString()
  @IsNotEmpty()
  fileKey!: string;

  @ApiProperty({
    description: 'File MIME Type',
    example: 'image/jpeg',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
  mimeType!: string;

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
    description:
      'Optional id of an existing photo in the same event whose metadata ' +
      '(`uploadedByGuestId`, `exifTakenAt`) should be inherited by the new ' +
      'photo. Used by the host "새로운 사진으로 저장" flow so the edited copy ' +
      'keeps the original uploader and taken-at timestamp.',
    required: false,
    example: 'photo-uuid',
  })
  @IsString()
  @IsOptional()
  sourcePhotoId?: string;
}
