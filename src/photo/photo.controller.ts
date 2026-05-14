import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionType } from '@prisma/client';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { PhotoService } from './photo.service';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { CreateUploadUrlsDto } from './dto/create-upload-urls.dto';
import { ReplacePhotoFileDto } from './dto/replace-photo-file.dto';
import {
  BasePhotoResponseDto,
  CreateUploadUrlsResponseDto,
  PhotoDetailResponseDto,
  SignedPhotoResponseDto,
} from './dto/photo-response.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request-types';

@ApiTags('Photo')
@ApiBearerAuth('access-token')
@Controller('photo')
@UseGuards(AccessTokenGuard)
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  @ApiOperation({ summary: 'Create guest photo upload signed URLs' })
  @ApiCreatedResponse({
    description: 'Signed URLs created successfully',
    type: CreateUploadUrlsResponseDto,
  })
  @Post('upload-url')
  createUploadUrls(
    @Req() req: AuthenticatedRequest,
    @Body() createUploadUrlsDto: CreateUploadUrlsDto,
  ) {
    this.assertGuest(req);
    return this.photoService.getSignedUrls(
      req.user.sub,
      createUploadUrlsDto.mimeType,
      createUploadUrlsDto.fileCount,
    );
  }

  @ApiOperation({ summary: 'Save guest uploaded photo metadata' })
  @ApiCreatedResponse({
    description: 'Photo metadata saved successfully',
    type: BasePhotoResponseDto,
  })
  @ApiConflictResponse({
    description: 'Photo with the same file key already exists',
  })
  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() createPhotoDto: CreatePhotoDto,
  ) {
    this.assertGuest(req);
    return this.photoService.create(req.user.sub, createPhotoDto);
  }

  @ApiOperation({ summary: 'Get photos uploaded by the authenticated guest' })
  @ApiOkResponse({ type: [SignedPhotoResponseDto] })
  @Get('my')
  findMyPhotos(@Req() req: AuthenticatedRequest) {
    this.assertGuest(req);
    return this.photoService.findAllByGuest(req.user.sub);
  }

  @ApiOperation({
    summary: 'Delete a photo uploaded by the authenticated guest',
  })
  @ApiNotFoundResponse({ description: 'Photo not found or not owned by guest' })
  @ApiOkResponse({
    description:
      'Photo deleted successfully. If already downloaded, returns a warning object instead of deleting.',
    schema: {
      oneOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            photo: { type: 'object' },
            deleted: { type: 'boolean', example: false },
            warning: {
              type: 'string',
              example: '신랑/신부가 이미 사진을 다운받았을 수도 있습니다.',
            },
          },
        },
      ],
    },
  })
  @Delete(':photoId')
  remove(@Req() req: AuthenticatedRequest, @Param('photoId') photoId: string) {
    this.assertGuest(req);
    return this.photoService.remove(photoId, req.user.sub);
  }

  @ApiOperation({ summary: 'Get photo detail with original photo URL' })
  @ApiOkResponse({ type: PhotoDetailResponseDto })
  @Get('detail/:photoId')
  getDetail(
    @Req() req: AuthenticatedRequest,
    @Param('photoId') photoId: string,
  ) {
    this.assertUser(req);
    return this.photoService.getDetail(req.user.sub, photoId);
  }

  @ApiOperation({ summary: 'Toggle photo favorite status' })
  @ApiNotFoundResponse({ description: 'Photo not found' })
  @ApiOkResponse({
    description: 'Photo favorite status toggled successfully',
    type: BasePhotoResponseDto,
  })
  @Patch(':photoId/favorite')
  toggleFavorite(
    @Req() req: AuthenticatedRequest,
    @Param('photoId') photoId: string,
  ) {
    this.assertUser(req);
    return this.photoService.toggleFavorite(req.user.sub, photoId);
  }

  @ApiOperation({
    summary: 'Delete any photo within an event owned by the authenticated host',
    description:
      'Soft-hides the photo from every host-facing query (album views, ' +
      'timeline, favorites, uploader grouping, similar-composition grouping, ' +
      'search, photo detail, photo groups). The underlying object in object ' +
      'storage is intentionally NOT removed, and the uploader guest still ' +
      'sees the photo in their own /photo/my listing. ' +
      'Idempotent: calling DELETE on an already-hidden photo returns 204. ' +
      'Requires a host (USER) access token; the principal must own the event ' +
      'the photo belongs to. Distinct from `DELETE /photo/{photoId}` which ' +
      'is the uploader-guest self-delete and removes the object from storage.',
  })
  @ApiParam({
    name: 'photoId',
    description: 'ID of the photo to hide from host views',
    example: 'photo-uuid',
  })
  @ApiNoContentResponse({
    description: 'Photo hidden from host views (or was already hidden).',
  })
  @ApiForbiddenResponse({
    description:
      'Caller is not authenticated as a host (USER session) OR does not own the event the photo belongs to.',
  })
  @ApiNotFoundResponse({
    description:
      'Photo does not exist, has been guest-deleted, or is outside any event the caller owns.',
  })
  @HttpCode(204)
  @Delete('host/:photoId')
  async hideForHost(
    @Req() req: AuthenticatedRequest,
    @Param('photoId') photoId: string,
  ): Promise<void> {
    this.assertUser(req);
    await this.photoService.hidePhotoForHost(req.user.sub, photoId);
  }

  @ApiOperation({
    summary: 'Replace the underlying file of an existing host-owned photo',
    description:
      'Host (event owner) overrides a photo in place with edited bytes — used ' +
      'by the "기본 사진으로 저장" save mode in the host edit flow. ' +
      'Compare with `POST /photo` which always creates a new photo record ' +
      '(used by "새로운 사진으로 저장"). ' +
      '\n\n' +
      '**Preserved fields:** `id`, `eventId`, `uploadedByGuestId`, uploader ' +
      'message, favorites, group memberships, `uploadedAt`, `createdAt`, ' +
      '`exifTakenAt`. ' +
      '\n\n' +
      '**Mutated fields:** `originalObjectKey`, `mimeType`, `fileSizeBytes`, ' +
      '`width`, `height`, `updatedAt` (auto-advanced). ' +
      '\n\n' +
      '**Side effects:** the previous storage object is best-effort deleted ' +
      'after the metadata swap commits (failure to delete does NOT roll back ' +
      'the swap). The matching `isOriginal` PhotoVersion row, if present, is ' +
      'updated to point at the new `fileKey` so version listings stay ' +
      'consistent with `Photo.originalObjectKey`. ' +
      '\n\n' +
      '**Auth:** caller must be authenticated as a host (USER session) and ' +
      'must own the event the photo belongs to. Photos that have been ' +
      'guest-deleted or host-hidden are not reachable via this endpoint.',
  })
  @ApiParam({
    name: 'photoId',
    description: 'ID of the photo whose underlying file will be swapped.',
    example: 'photo-uuid',
  })
  @ApiOkResponse({
    description:
      'Photo file replaced. Returns the refreshed `PhotoDetailResponseDto` ' +
      'with a freshly signed read URL pointing at the new object.',
    type: PhotoDetailResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Request body failed validation (e.g. missing/empty `fileKey`, missing ' +
      '`mimeType`, non-integer dimensions, dimensions out of range, or ' +
      'unknown properties — `forbidNonWhitelisted` is enabled globally).',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid bearer access token.',
  })
  @ApiForbiddenResponse({
    description:
      'Caller is not authenticated as a host (USER session) OR does not own ' +
      'the event the photo belongs to.',
  })
  @ApiNotFoundResponse({
    description:
      'Photo does not exist, has been soft-deleted, host-hidden, or is ' +
      'outside an event the caller owns.',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'Business-rule failure (returned as 422): unsupported MIME type, ' +
      "`fileKey` does not live under the photo's event prefix " +
      '(`events/{photo.eventId}/...`), or `fileKey` equals the current ' +
      '`originalObjectKey`.',
  })
  @ApiConflictResponse({
    description:
      'Another photo already references the supplied `fileKey` ' +
      '(unique-constraint violation on `Photo.originalObjectKey`).',
  })
  @Post(':photoId/replace')
  replaceFile(
    @Req() req: AuthenticatedRequest,
    @Param('photoId') photoId: string,
    @Body() replacePhotoFileDto: ReplacePhotoFileDto,
  ) {
    this.assertUser(req);
    return this.photoService.replacePhotoFile(
      req.user.sub,
      photoId,
      replacePhotoFileDto,
    );
  }

  // Helper methods to assert session type
  private assertGuest(req: AuthenticatedRequest) {
    if (req.user.sessionType !== SessionType.GUEST) {
      throw new UnauthorizedException('Guest access token is required');
    }
  }

  private assertUser(req: AuthenticatedRequest) {
    if (req.user.sessionType !== SessionType.USER) {
      throw new UnauthorizedException('User access token is required');
    }
  }
}
