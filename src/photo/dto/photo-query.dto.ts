import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PHOTO_SORT_BY_VALUES = ['uploadedAt', 'takenAt'] as const;
export type PhotoSortBy = (typeof PHOTO_SORT_BY_VALUES)[number];

export class EventIdQueryDto {
  @ApiProperty({ description: 'Event ID' })
  @IsString()
  @IsNotEmpty()
  eventId!: string;
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Offset', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset = 0;

  @ApiPropertyOptional({ description: 'Page Number', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({
    description: 'Sorting Order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  order: 'asc' | 'desc' = 'desc';
}

export class EventAlbumQueryDto extends EventIdQueryDto {
  @ApiPropertyOptional({
    description: 'Sorting field for the album view',
    enum: PHOTO_SORT_BY_VALUES,
    default: 'uploadedAt',
  })
  @IsIn(PHOTO_SORT_BY_VALUES)
  @IsOptional()
  sortBy: PhotoSortBy = 'uploadedAt';

  @ApiPropertyOptional({
    description: 'Sorting order applied to the selected album sort field',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  order: 'asc' | 'desc' = 'desc';
}
