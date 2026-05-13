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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PhotoService } from './photo.service';
import {
  EventIdQueryDto,
  PhotoPaginationQueryDto,
} from './dto/photo-query.dto';
import { SearchPhotosQueryDto } from './dto/search-photos.dto';
import { SearchUploaderDto } from './dto/search-uploader.dto';
import {
  PhotoPageResponseDto,
  SearchPhotoPageResponseDto,
  SignedPhotoResponseDto,
  SimilarCompositionGroupResponseDto,
  TimelineBucketResponseDto,
  UploaderGroupResponseDto,
  UploaderSearchResultResponseDto,
} from './dto/photo-response.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request-types';

@ApiTags('Photo Views')
@ApiBearerAuth('access-token')
@Controller('photo/views')
@UseGuards(AccessTokenGuard)
export class PhotoViewsController {
  constructor(private readonly photoService: PhotoService) {}

  @ApiOperation({ summary: 'Get all event photos with pagination' })
  @ApiOkResponse({ type: PhotoPageResponseDto })
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
  @ApiOkResponse({ type: [TimelineBucketResponseDto] })
  @Get('timeline')
  getTimeline(
    @Req() req: AuthenticatedRequest,
    @Query() query: EventIdQueryDto,
  ) {
    this.assertUser(req);
    return this.photoService.getTimeline(req.user.sub, query.eventId);
  }

  @ApiOperation({ summary: 'Get favorite photos for an event' })
  @ApiOkResponse({ type: [SignedPhotoResponseDto] })
  @Get('favorites')
  getFavorites(
    @Req() req: AuthenticatedRequest,
    @Query() query: EventIdQueryDto,
  ) {
    this.assertUser(req);
    return this.photoService.getFavoritePhotos(req.user.sub, query.eventId);
  }

  @ApiOperation({ summary: 'Get photos grouped by similar composition' })
  @ApiOkResponse({ type: [SimilarCompositionGroupResponseDto] })
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
  @ApiOkResponse({ type: [UploaderGroupResponseDto] })
  @Get('uploader-grouping')
  getUploaderGrouping(
    @Req() req: AuthenticatedRequest,
    @Query() query: EventIdQueryDto,
  ) {
    this.assertUser(req);
    return this.photoService.getGroupedByUploader(req.user.sub, query.eventId);
  }

  @ApiOperation({ summary: 'Search uploader names by partial match' })
  @ApiOkResponse({ type: [UploaderSearchResultResponseDto] })
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

  @ApiOperation({
    summary: 'Search photos within an event by uploader name, message, or tag',
    description:
      'Returns photos in the given event whose uploader name OR uploader message (case-insensitive partial match) matches `q`. ' +
      'Page size is fixed at 20 and pagination follows `skip = offset + (page - 1) * 20`. ' +
      'When the result matched on message text, each photo carries a `matchedMessage` snippet (≤200 chars); ' +
      'otherwise `matchedMessage` is `null`. ' +
      'The `fields` query selects which sources to search; `tags` is accepted but currently a no-op because the Tag schema is not yet modeled. ' +
      'LIKE wildcards (`%`, `_`, `\\`) in `q` are escaped server-side so user input cannot expand the pattern. ' +
      'Accessible to event owners (USER session) and registered guests of that event (GUEST session).',
  })
  @ApiOkResponse({
    description: 'Page of photos matching the query.',
    type: SearchPhotoPageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed: `q` empty/whitespace or >100 chars, `fields` contains an unknown value, or pagination params are out of range.',
  })
  @ApiForbiddenResponse({
    description: 'Caller is neither the event owner nor a guest of the event.',
  })
  @Get('search')
  search(
    @Req() req: AuthenticatedRequest,
    @Query() query: SearchPhotosQueryDto,
  ) {
    return this.photoService.searchPhotos(
      { sub: req.user.sub, sessionType: req.user.sessionType },
      {
        eventId: query.eventId,
        query: query.q,
        fields: query.fields,
        offset: query.offset,
        page: query.page,
        order: query.order,
      },
    );
  }

  private assertUser(req: AuthenticatedRequest) {
    if (req.user.sessionType !== SessionType.USER) {
      throw new UnauthorizedException('User access token is required');
    }
  }
}
