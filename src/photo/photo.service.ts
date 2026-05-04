import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
import { PhotoRepository } from './repositories/photo.repository';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

import { PhotoController } from './photo.controller';

@Injectable()
export class PhotoService {
    private readonly storage: Storage;
  private readonly bucketName: string;

  constructor(private readonly photoRepository: PhotoRepository) {
    // GCS 초기화: GOOGLE_APPLICATION_CREDENTIALS 환경변수를 자동으로 읽습니다.
    this.storage = new Storage();
    this.bucketName = process.env.GCP_STORAGE_BUCKET || ''; //나중에 수정!!!
  }

  // [기능 1] 하객에게 사진 업로드용 티켓(Signed URL) 발급
  async getSignedUrl(eventId: string, guestId: string, mimeType: string) {
    try {
      const fileName = `events/${eventId}/${guestId}/${uuidv4()}`;
      const blob = this.storage.bucket(this.bucketName).file(fileName);

      const [url] = await blob.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 5 * 60 * 1000, // 5분
        contentType: mimeType,
      });

      return { uploadUrl: url, fileKey: fileName };
    } catch (error) {
      throw new InternalServerErrorException('GCS 주소 생성 실패');
    }
  }

  // [기능 2] 업로드 완료 후 DB에 기록
  async create(guestId: string, createPhotoDto: CreatePhotoDto) {
    const { eventId, fileKey, embedding } = createPhotoDto;
    
    // 임베딩이 없다면 임시로 생성 (나중에 AI 엔진 연결 시 제거)
    const finalEmbedding = embedding || Array.from({ length: 128 }, () => Math.random());
    
    return this.photoRepository.createPhoto(
      eventId,
      guestId, fileKey, // GCS 경로
      finalEmbedding,
    );
  }
  
  //******************************* guest 기능 ************************************************
  // [기능] 하객 본인의 사진들만 조회
  async findAllByGuest(guestId: string, eventId: string) {
    return this.photoRepository.findPhotosByGuest(guestId, eventId);}

  // [기능] 사진 삭제 (본인인지 확인 필수)
  async remove(photoId: string, guestId: string) {
    // 1. 먼저 해당 사진이 있는지, 누가 올렸는지 확인
    const photo = await this.photoRepository.findOne(photoId);
    
    if (!photo) {
      throw new Error('사진을 찾을 수 없습니다.');
    }

    // 2. 사진을 올린 사람과 삭제 요청자가 다르면 에러
    if (photo.uploadedByGuestId !== guestId) {
      throw new Error('본인이 올린 사진만 삭제할 수 있습니다.');
    }

    return this.photoRepository.deletePhoto(photoId);
  }

  //******************************** user 기능 ****************************************************
  // [기능] 전체 앨범 조회 (필터 및 그룹화 대응)
  async getFullAlbum(eventId: string, mode: 'timeline' | 'uploader' | 'favorite' | 'composition') {
    const photos = await this.photoRepository.findAllByEvent(eventId, mode === 'favorite');
    
    //비슷한 구도
    if (mode === 'composition') {
    return this.getGroupedByComposition(eventId);
  }

    // 업로더(Guest)별로 사진 그룹화
    if (mode === 'uploader') {
      
      return photos.reduce((acc, photo) => {
        const uploaderName = photo.uploadedByGuest?.name || '익명';
        if (!acc[uploaderName]) acc[uploaderName] = [];
        acc[uploaderName].push(photo);
        return acc;
      }, {} as Record<string, any[]>);
    }

    return photos;
  }

  // [기능] 즐겨찾기 토글
  async toggleFavorite(photoId: string) {
    return this.photoRepository.toggleFavorite(photoId);
  }

  // 비슷한 구도(임베딩 유사도)끼리 사진 그룹핑
async getGroupedByComposition(eventId: string) {
  const photos = await this.photoRepository.findEmbeddingsByEvent(eventId);
  if (photos.length === 0) return {};

  const groups: Record<string, any[]> = {};
  const visited = new Set<string>();
  const THRESHOLD = 0.85; // 유사도 기준 (0.85 이상이면 같은 구도로 판단)

  let groupCount = 1;

  for (let i = 0; i < photos.length; i++) {
    if (visited.has(photos[i].id)) continue;

    const currentGroup = [photos[i]];
    visited.add(photos[i].id);

    for (let j = i + 1; j < photos.length; j++) {
      if (visited.has(photos[j].id)) continue;

      // 코사인 유사도 계산 (TypeScript 버전)
      const similarity = this.calculateCosineSimilarity(
        photos[i].embedding as number[],
        photos[j].embedding as number[]
      );

      if (similarity > THRESHOLD) {
        currentGroup.push(photos[j]);
        visited.add(photos[j].id);
      }
    }

    groups[`구도 ${groupCount++}`] = currentGroup;
  }

  return groups;
}

// 유사도 계산 보조 함수
private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magA * magB);
}

}
