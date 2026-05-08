import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionType } from '@prisma/client';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PhotoService } from './photo.service';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { CreateUploadUrlsDto } from './dto/create-upload-urls.dto';
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

  @ApiOperation({ summary: 'Get photo detail with original photo URL' })
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
