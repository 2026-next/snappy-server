import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SessionType } from '@prisma/client';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request-types';
import { PhotoAiService } from './photo-ai.service';
import { CreateEnhancementDto } from './dto/create-enhancement.dto';

@ApiTags('Photo AI')
@ApiBearerAuth('access-token')
@Controller('photo')
@UseGuards(AccessTokenGuard)
export class PhotoAiController {
  constructor(private readonly photoAiService: PhotoAiService) {}

  @ApiOperation({ summary: 'Get AI analysis job status and result' })
  @ApiOkResponse({ description: 'Analysis job state' })
  @ApiNotFoundResponse({ description: 'Photo or analysis job not found' })
  @Get(':photoId/analysis')
  getAnalysis(
    @Req() req: AuthenticatedRequest,
    @Param('photoId') photoId: string,
  ) {
    this.assertUser(req);
    return this.photoAiService.getAnalysis(photoId, req.user.sub);
  }

  @ApiOperation({ summary: 'Create AI enhancement job' })
  @ApiAcceptedResponse({ description: 'Enhancement job created' })
  @ApiNotFoundResponse({ description: 'Photo not found' })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post(':photoId/enhancement')
  createEnhancement(
    @Req() req: AuthenticatedRequest,
    @Param('photoId') photoId: string,
    @Body() dto: CreateEnhancementDto,
  ) {
    this.assertUser(req);
    return this.photoAiService.createEnhancement(
      photoId,
      req.user.sub,
      dto.prompt,
    );
  }

  @ApiOperation({ summary: 'Get AI enhancement job status and result' })
  @ApiOkResponse({ description: 'Enhancement job state' })
  @ApiNotFoundResponse({ description: 'Photo or enhancement job not found' })
  @Get(':photoId/enhancement/:jobId')
  getEnhancement(
    @Req() req: AuthenticatedRequest,
    @Param('photoId') photoId: string,
    @Param('jobId') jobId: string,
  ) {
    this.assertUser(req);
    return this.photoAiService.getEnhancement(photoId, req.user.sub, jobId);
  }

  @ApiOperation({
    summary: 'List all versions of a photo (original + AI enhancements)',
  })
  @ApiOkResponse({ description: 'Photo version list' })
  @ApiNotFoundResponse({ description: 'Photo not found' })
  @Get(':photoId/versions')
  listVersions(
    @Req() req: AuthenticatedRequest,
    @Param('photoId') photoId: string,
  ) {
    this.assertUser(req);
    return this.photoAiService.listVersions(photoId, req.user.sub);
  }

  private assertUser(req: AuthenticatedRequest) {
    if (req.user.sessionType !== SessionType.USER) {
      throw new UnauthorizedException('User access token is required');
    }
  }
}
