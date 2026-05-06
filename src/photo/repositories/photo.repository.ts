import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PhotoRepository {
  constructor(private readonly prisma: PrismaService) {}

  // 사진 저장 (임베딩 포함)
  async createPhoto(
    eventId: string,
    guestId: string,
    url: string,
    embedding: number[],
  ) {
    return this.prisma.photo.create({
      data: {
        eventId,
        uploadedByGuestId: guestId,
        originalObjectKey: url, // S3 키 등으로 활용
        embedding,
      },
    });
  }

  // [기능] 특정 이벤트의 모든 사진 가져오기 (타임라인/즐겨찾기 필터 포함)
  async findAllByEvent(eventId: string, onlyFavorites: boolean = false) {
    return this.prisma.photo.findMany({
      where: {
        eventId,
        ...(onlyFavorites && { isFavorite: true }), // 즐겨찾기 필터링
      },
      include: {
        uploadedByGuest: { // 업로더 정보를 가져오기 위해 연결
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }, // 타임라인(최신순) 정렬
    });
  }

  // [기능] 즐겨찾기 토글 (상태 반전)
  async toggleFavorite(photoId: string) {
    const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
    return this.prisma.photo.update({
      where: { id: photoId },
      data: { isFavorite: !photo?.isFavorite },
    });
  }


  async findPhotosByGuest(guestId: string, eventId: string) {
    return this.prisma.photo.findMany({
      where: {
        uploadedByGuestId: guestId,
        eventId: eventId,
      },
      orderBy: { createdAt: 'desc' }, // 최신순
    });
  }

  async findOne(id: string) {
    return this.prisma.photo.findUnique({
      where: { id },
    });
  }

  async deletePhoto(id: string) {
    return this.prisma.photo.delete({
      where: { id },
    });
  }

  async findEmbeddingsByEvent(eventId: string) {
  return this.prisma.photo.findMany({
    where: { eventId },
    select: {
      id: true,
      originalObjectKey: true,
      embedding: true,
    },
  });
}
}
