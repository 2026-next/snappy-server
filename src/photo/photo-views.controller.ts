import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionType } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PhotoService } from './photo.service';
import {
  EventIdQueryDto,
  PhotoPaginationQueryDto,
} from './dto/photo-query.dto';
import { SearchUploaderDto } from './dto/search-uploader.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request-types';

@ApiTags('Photo Views')
@ApiBearerAuth('access-token')
@Controller('photo/views')
@UseGuards(AccessTokenGuard)
export class PhotoViewsController {
  constructor(private readonly photoService: PhotoService) {}

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

  @ApiOperation({ summary: 'Get favorite photos for an event' })
  @Get('favorites')
  getFavorites(
    @Req() req: AuthenticatedRequest,
    @Query() query: EventIdQueryDto,
  ) {
    this.assertUser(req);
    return this.photoService.getFavoritePhotos(req.user.sub, query.eventId);
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

  private assertUser(req: AuthenticatedRequest) {
    if (req.user.sessionType !== SessionType.USER) {
      throw new UnauthorizedException('User access token is required');
    }
  }
}
