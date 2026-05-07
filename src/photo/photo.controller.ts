import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionType } from '@prisma/client';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PhotoService } from './photo.service';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { CreateUploadUrlsDto } from './dto/create-upload-urls.dto';
import {
  EventIdQueryDto,
  PhotoPaginationQueryDto,
} from './dto/photo-query.dto';
import { SearchUploaderDto } from './dto/search-uploader.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request-types';

@ApiTags('Photo')
@ApiBearerAuth('access-token')
@Controller('photo')
@UseGuards(AccessTokenGuard)
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  @ApiOperation({ summary: 'Create guest photo upload signed URLs' })
  @ApiCreatedResponse({ description: 'Signed URLs created successfully'})
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
  @ApiCreatedResponse({ description: 'Photo metadata saved successfully' })
  @ApiConflictResponse({ description: 'Photo with the same file key already exists' })
  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() createPhotoDto: CreatePhotoDto,
  ) {
    this.assertGuest(req);
    return this.photoService.create(req.user.sub, createPhotoDto);
  }

  @ApiOperation({ summary: 'Get photos uploaded by the authenticated guest' })
  @Get('my')
  findMyPhotos(@Req() req: AuthenticatedRequest) {
    this.assertGuest(req);
    return this.photoService.findAllByGuest(req.user.sub);
  }

  @ApiOperation({
    summary: 'Delete a photo uploaded by the authenticated guest',
  })
  @ApiNotFoundResponse({ description: 'Photo not found or not owned by guest' })
  @ApiOkResponse({ description: 'Photo deleted successfully' })
  @Delete(':photoId')
  remove(@Req() req: AuthenticatedRequest, @Param('photoId') photoId: string) {
    this.assertGuest(req);
    return this.photoService.remove(photoId, req.user.sub);
  }

  @ApiOperation({ summary: 'Get all event photos with pagination' })
  @Get()
  getAlbum(
    @Req() req: AuthenticatedRequest,
    @Query() query: PhotoPaginationQueryDto,
  ) {
    this.assertUser(req);
    return this.photoService.getFullAlbum(
      req.user.sub,
      query.eventId,
      query.offset,
      query.page,
      query.order,
    );
  }

  @ApiOperation({ summary: 'Get event photo timeline' })
  @Get('timeline')
  getTimeline(
    @Req() req: AuthenticatedRequest,
    @Query() query: EventIdQueryDto,
  ) {
    this.assertUser(req);
    return this.photoService.getTimeline(req.user.sub, query.eventId);
  }

  @ApiOperation({ summary: 'Get photos grouped by similar composition' })
  @Get('similar-composition')
  getSimilarComposition(
    @Req() req: AuthenticatedRequest,
    @Query() query: EventIdQueryDto,
  ) {
    this.assertUser(req);
    return this.photoService.getGroupedByComposition(
      req.user.sub,
      query.eventId,
    );
  }

  @ApiOperation({ summary: 'Get photos grouped by uploader' })
  @Get('uploader-grouping')
  getUploaderGrouping(
    @Req() req: AuthenticatedRequest,
    @Query() query: EventIdQueryDto,
  ) {
    this.assertUser(req);
    return this.photoService.getGroupedByUploader(req.user.sub, query.eventId);
  }

  @ApiOperation({ summary: 'Get photo detail with original photo URL' })
  @Get('detail/:photoId')
  getDetail(
    @Req() req: AuthenticatedRequest,
    @Param('photoId') photoId: string,
  ) {
    this.assertUser(req);
    return this.photoService.getDetail(req.user.sub, photoId);
  }

  @ApiOperation({ summary: 'Search uploader names by partial match' })
  @Post('uploader-search')
  searchUploader(
    @Req() req: AuthenticatedRequest,
    @Body() searchUploaderDto: SearchUploaderDto,
  ) {
    this.assertUser(req);
    return this.photoService.searchUploader(
      req.user.sub,
      searchUploaderDto.eventId,
      searchUploaderDto.name,
    );
  }

  @ApiOperation({ summary: 'Toggle photo favorite status' })
  @ApiNotFoundResponse({ description: 'Photo not found' })
  @ApiOkResponse({ description: 'Photo favorite status toggled successfully' })
  @Patch(':photoId/favorite')
  toggleFavorite(
    @Req() req: AuthenticatedRequest,
    @Param('photoId') photoId: string,
  ) {
    this.assertUser(req);
    return this.photoService.toggleFavorite(req.user.sub, photoId);
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
