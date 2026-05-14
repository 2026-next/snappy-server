import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHostUploadUrlsDto {
  @ApiProperty({
    description:
      'ID of the event the host owns. Generated upload URLs will live ' +
      'under the `events/{eventId}/host-edits/...` prefix, satisfying the ' +
      'event-prefix check used by `POST /photo/{photoId}/replace` and ' +
      '`POST /photo/host`.',
    example: 'cmoohra6a000115zyl8cnomj2',
  })
  @IsString()
  @IsNotEmpty()
  eventId!: string;

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
