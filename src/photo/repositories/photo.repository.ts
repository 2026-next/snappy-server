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

<<<<<<< HEAD
  // 코사인 유사도로 내 얼굴과 닮은 사진 찾기
  async findSimilarPhotos(
    targetEmbedding: number[],
    eventId: string,
    limit: number = 10,
  ) {
    // pgvector를 쓰지 않고 표준 SQL로 계산하는 방식입니다.
    return this.prisma.$queryRaw`
      SELECT p.id, p."originalObjectKey",
        (
          SELECT SUM(a*b) / (SQRT(SUM(a*a)) * SQRT(SUM(b*b)))
          FROM UNNEST(p.embedding) AS a, UNNEST(${targetEmbedding}::float8[]) AS b
        ) as similarity
      FROM "Photo" p
      WHERE p."eventId" = ${eventId}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;
  }
}
=======
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
>>>>>>> d278f89 (feat: 사진 업로드 및 구도 그룹핑 기능 구현)
