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
} from '@nestjs/swagger';
import { PhotoService } from './photo.service';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { CreateUploadUrlsDto } from './dto/create-upload-urls.dto';
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
