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
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PhotoService } from './photo.service';
import { CreatePhotoGroupDto } from './dto/create-photo-group.dto';
import { EventIdQueryDto, PaginationQueryDto } from './dto/photo-query.dto';
import { PhotoGroupPhotosDto } from './dto/photo-group-photos.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request-types';

@ApiTags('Photo Groups')
@ApiBearerAuth('access-token')
@Controller('photo/groups')
@UseGuards(AccessTokenGuard)
export class PhotoGroupsController {
  constructor(private readonly photoService: PhotoService) {}

  @ApiOperation({ summary: 'Create a custom photo group' })
  @ApiCreatedResponse({ description: 'Photo group created successfully' })
  @ApiConflictResponse({ description: 'Photo group name already exists' })
  @Post()
  createGroup(
    @Req() req: AuthenticatedRequest,
    @Body() createPhotoGroupDto: CreatePhotoGroupDto,
  ) {
    this.assertUser(req);
    return this.photoService.createPhotoGroup(req.user.sub, createPhotoGroupDto);
  }

  @ApiOperation({ summary: 'Get custom photo groups for an event' })
  @Get()
  getGroups(@Req() req: AuthenticatedRequest, @Query() query: EventIdQueryDto) {
    this.assertUser(req);
    return this.photoService.getPhotoGroups(req.user.sub, query.eventId);
  }

  @ApiOperation({ summary: 'Get photos in a custom photo group' })
  @Get(':groupId/photos')
  getGroupPhotos(
    @Req() req: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Query() query: PaginationQueryDto,
  ) {
    this.assertUser(req);
    return this.photoService.getPhotoGroupPhotos(
      req.user.sub,
      groupId,
      query.offset,
      query.page,
      query.order,
    );
  }

  @ApiOperation({ summary: 'Add photos to a custom photo group' })
  @Post(':groupId/photos')
  addGroupPhotos(
    @Req() req: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Body() photoGroupPhotosDto: PhotoGroupPhotosDto,
  ) {
    this.assertUser(req);
    return this.photoService.addPhotosToGroup(
      req.user.sub,
      groupId,
      photoGroupPhotosDto,
    );
  }

  @ApiOperation({ summary: 'Replace photos in a custom photo group' })
  @Patch(':groupId/photos')
  replaceGroupPhotos(
    @Req() req: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Body() photoGroupPhotosDto: PhotoGroupPhotosDto,
  ) {
    this.assertUser(req);
    return this.photoService.replaceGroupPhotos(
      req.user.sub,
      groupId,
      photoGroupPhotosDto,
    );
  }

  @ApiOperation({ summary: 'Remove a photo from a custom photo group' })
  @Delete(':groupId/photos/:photoId')
  removeGroupPhoto(
    @Req() req: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('photoId') photoId: string,
  ) {
    this.assertUser(req);
    return this.photoService.removePhotoFromGroup(
      req.user.sub,
      groupId,
      photoId,
    );
  }

  private assertUser(req: AuthenticatedRequest) {
    if (req.user.sessionType !== SessionType.USER) {
      throw new UnauthorizedException('User access token is required');
    }
  }
}
