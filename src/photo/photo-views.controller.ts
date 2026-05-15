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
import { EventAlbumQueryDto, EventIdQueryDto } from './dto/photo-query.dto';
import { SearchPhotosQueryDto } from './dto/search-photos.dto';
import { SearchUploaderDto } from './dto/search-uploader.dto';
import {
  MatchedSignedPhotoResponseDto,
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

  @ApiOperation({ summary: 'Get every photo in the event (no pagination)' })
  @ApiOkResponse({ type: [SignedPhotoResponseDto] })
  @Get()
  getAlbum(
    @Req() req: AuthenticatedRequest,
    @Query() query: EventAlbumQueryDto,
  ) {
    this.assertUser(req);
    return this.photoService.getFullAlbum(
      req.user.sub,
      query.eventId,
      query.sortBy,
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
      'Returns every photo in the given event whose uploader name OR uploader message (case-insensitive partial match) matches `q`. ' +
      'No pagination is applied — all matching photos are returned. ' +
      'When the result matched on message text, each photo carries a `matchedMessage` snippet (≤200 chars); ' +
      'otherwise `matchedMessage` is `null`. ' +
      'The `fields` query selects which sources to search; `tags` is accepted but currently a no-op because the Tag schema is not yet modeled. ' +
      'LIKE wildcards (`%`, `_`, `\\`) in `q` are escaped server-side so user input cannot expand the pattern. ' +
      'Accessible to event owners (USER session) and registered guests of that event (GUEST session).',
  })
  @ApiOkResponse({
    description: 'All photos matching the query.',
    type: [MatchedSignedPhotoResponseDto],
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed: `q` empty/whitespace or >100 chars, or `fields` contains an unknown value.',
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
