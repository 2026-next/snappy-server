import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadUrlResponseDto {
  @ApiProperty({ example: 'https://storage.googleapis.com/signed-upload-url' })
  uploadUrl!: string;

  @ApiProperty({ example: 'events/event-uuid/guest-uuid/photo.jpg' })
  fileKey!: string;
}

export class CreateUploadUrlsResponseDto {
  @ApiProperty({ type: () => UploadUrlResponseDto, isArray: true })
  uploadUrls!: UploadUrlResponseDto[];
}

export class UploaderMetadataResponseDto {
  @ApiProperty({ example: 'guest-uuid', nullable: true })
  id!: string | null;

  @ApiProperty({ example: '김민준' })
  name!: string;

  @ApiProperty({ example: 'FRIEND', nullable: true })
  relation!: string | null;
}

export class BasePhotoResponseDto {
  @ApiProperty({ example: 'photo-uuid' })
  id!: string;

  @ApiProperty({ example: 'events/event-uuid/guest-uuid/photo.jpg' })
  originalObjectKey!: string;

  @ApiPropertyOptional({ example: 'image/jpeg', nullable: true })
  mimeType?: string | null;

  @ApiPropertyOptional({ example: 2048000, nullable: true })
  fileSizeBytes?: number | null;

  @ApiPropertyOptional({ example: 1920, nullable: true })
  width?: number | null;

  @ApiPropertyOptional({ example: 1080, nullable: true })
  height?: number | null;

  @ApiPropertyOptional({ example: '2026-05-12T08:30:00.000Z', nullable: true })
  exifTakenAt?: Date | null;

  @ApiProperty({ example: '2026-05-12T08:30:00.000Z' })
  uploadedAt!: Date;

  @ApiProperty({ example: false })
  isDeleted!: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  deletedAt?: Date | null;

  @ApiProperty({ example: false })
  isDownloaded!: boolean;

  @ApiProperty({ example: false })
  isFavorite!: boolean;

  @ApiProperty({ example: 'event-uuid' })
  eventId!: string;

  @ApiPropertyOptional({ example: 'guest-uuid', nullable: true })
  uploadedByGuestId?: string | null;

  @ApiProperty({ type: Number, isArray: true, example: [0.1, 0.2] })
  embedding!: number[];

  @ApiProperty({ example: '2026-05-12T08:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-12T08:30:00.000Z' })
  updatedAt!: Date;
}

export class SignedPhotoResponseDto extends BasePhotoResponseDto {
  @ApiProperty({
    example: 'https://storage.googleapis.com/signed-read-url',
    nullable: true,
  })
  originalPhotoUrl!: string | null;

  @ApiProperty({
    example: 'https://storage.googleapis.com/signed-read-url',
    nullable: true,
  })
  url!: string | null;

  @ApiProperty({
    example: 'https://storage.googleapis.com/signed-read-url',
    nullable: true,
  })
  signedUrl!: string | null;

  @ApiPropertyOptional({ example: 'guest-uuid', nullable: true })
  uploaderId?: string | null;

  @ApiPropertyOptional({ example: '김민준' })
  uploaderName?: string;

  @ApiPropertyOptional({ enum: [1, 2, 3, 4, 5, 6, 7], nullable: true })
  uploaderRelation?: number | null;

  @ApiPropertyOptional({
    type: () => UploaderMetadataResponseDto,
    nullable: true,
  })
  uploadedByGuest?: UploaderMetadataResponseDto | null;
}

export class PhotoEventSummaryResponseDto {
  @ApiProperty({ example: 'event-uuid' })
  id!: string;

  @ApiProperty({ example: 'Wedding' })
  name!: string;
}

export class PhotoDetailResponseDto extends SignedPhotoResponseDto {
  @ApiPropertyOptional({ type: () => PhotoEventSummaryResponseDto })
  event?: PhotoEventSummaryResponseDto;
}

export class PaginationResponseDto {
  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

export class PhotoPageResponseDto {
  @ApiProperty({ type: () => SignedPhotoResponseDto, isArray: true })
  photos!: SignedPhotoResponseDto[];

  @ApiProperty({ type: () => PaginationResponseDto })
  pagination!: PaginationResponseDto;
}

export class TimelineBucketResponseDto {
  @ApiProperty({ example: '2026-05-12' })
  date!: string;

  @ApiProperty({ example: '08:30' })
  time!: string;

  @ApiProperty({ type: () => SignedPhotoResponseDto, isArray: true })
  photos!: SignedPhotoResponseDto[];

  @ApiProperty({ example: 3 })
  totalCount!: number;
}

export class SimilarCompositionGroupResponseDto {
  @ApiProperty({ example: '구도 1' })
  groupName!: string;

  @ApiProperty({ type: () => SignedPhotoResponseDto, isArray: true })
  photos!: SignedPhotoResponseDto[];

  @ApiProperty({ example: 2 })
  totalCount!: number;
}

export class UploaderGroupResponseDto {
  @ApiProperty({ example: 'guest-uuid', nullable: true })
  id!: string | null;

  @ApiProperty({ example: 'guest-uuid', nullable: true })
  uploaderId!: string | null;

  @ApiProperty({ example: '김민준' })
  name!: string;

  @ApiProperty({ example: '김민준' })
  uploaderName!: string;

  @ApiProperty({ enum: [1, 2, 3, 4, 5, 6, 7], nullable: true })
  relation!: number | null;

  @ApiProperty({ enum: [1, 2, 3, 4, 5, 6, 7], nullable: true })
  uploaderRelation!: number | null;

  @ApiProperty({ type: () => UploaderMetadataResponseDto })
  uploader!: UploaderMetadataResponseDto;

  @ApiProperty({ type: () => SignedPhotoResponseDto, isArray: true })
  photos!: SignedPhotoResponseDto[];

  @ApiProperty({ example: 3 })
  totalCount!: number;
}

export class UploaderSearchResultResponseDto {
  @ApiProperty({ example: 'guest-uuid' })
  id!: string;

  @ApiProperty({ example: 'guest-uuid' })
  uploaderId!: string;

  @ApiProperty({ example: '김민준' })
  name!: string;

  @ApiProperty({ example: '김민준' })
  uploaderName!: string;

  @ApiProperty({ enum: [1, 2, 3, 4, 5, 6, 7], nullable: true })
  relation!: number | null;

  @ApiProperty({ enum: [1, 2, 3, 4, 5, 6, 7], nullable: true })
  uploaderRelation!: number | null;
}

export class PhotoGroupCountResponseDto {
  @ApiProperty({ example: 3 })
  photos!: number;
}

export class PhotoGroupResponseDto {
  @ApiProperty({ example: 'group-uuid' })
  id!: string;

  @ApiProperty({ example: 'Best shots' })
  name!: string;

  @ApiProperty({ example: 'event-uuid' })
  eventId!: string;

  @ApiProperty({ example: 'user-uuid' })
  createdByUserId!: string;

  @ApiPropertyOptional({ type: () => PhotoGroupCountResponseDto })
  _count?: PhotoGroupCountResponseDto;
}

export class PhotoGroupMutationResponseDto {
  @ApiProperty({ example: 3 })
  count!: number;
}

export class RemovePhotoFromGroupResponseDto {
  @ApiProperty({ example: true })
  removed!: boolean;
}
