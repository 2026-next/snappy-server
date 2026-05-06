import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query, 
  UseGuards,
  Req
} from '@nestjs/common';
import { PhotoService } from './photo.service';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request-types';



@Controller('photo')
@UseGuards(AccessTokenGuard)
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  // [기능] 업로드용 Signed URL 발급 (로그인된 하객 ID 사용)
  @Get('upload-url')
  async getUploadUrl(
    @Req() req: AuthenticatedRequest,
    @Query('eventId') eventId: string,
    @Query('mimeType') mimeType: string,
  ) {
    const guestId = req.user.sub; // 토큰에서 하객 ID 추출
    return this.photoService.getSignedUrl(eventId, guestId, mimeType);
  }

  // guest 기능
  // [기능] 사진 DB 저장
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() createPhotoDto: CreatePhotoDto) {
    const guestId = req.user.sub;
    return this.photoService.create(guestId, createPhotoDto);
  }
 
  // [기능] 내가 올린 사진만 조회
  @Get('my')
  async findMyPhotos(@Req() req: AuthenticatedRequest, @Query('eventId') eventId: string) {
    const guestId = req.user.sub;
    return this.photoService.findAllByGuest(guestId, eventId);
  }

  // [기능] 내 사진 삭제 (권한 검증 포함)
  @Delete(':id')
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const guestId = req.user.sub;
    return this.photoService.remove(id, guestId);
  }
  // user 기능
  // [기능] 전체 앨범 열람 (타임라인, 업로더, 즐겨찾기 통합)
  @Get('album/:eventId')
  async getAlbum(
    @Param('eventId') eventId: string,
    @Query('tag') tag: 'timeline' | 'uploader' | 'favorite' = 'timeline',
  ) {
    // TODO: 나중에 이 API는 주최자인지(SessionType.USER) 확인하는 로직을 추가하면 더 안전합니다.
    return this.photoService.getFullAlbum(eventId, tag);
  }

  // [기능] 즐겨찾기 토글
  @Patch(':id/favorite')
  async toggleFavorite(@Param('id') id: string) {
    return this.photoService.toggleFavorite(id);
  }
}
