const ICON_BASE = 'https://api.iconify.design/mdi';

export const DEFAULT_ENHANCEMENT_ICON_URL = `${ICON_BASE}/auto-fix.svg`;

const ENHANCEMENT_ICON_MAP: Record<string, string> = {
  '꽃 추가': `${ICON_BASE}/flower.svg`,
  아웃포커스: `${ICON_BASE}/blur.svg`,
  '풀 추가': `${ICON_BASE}/grass.svg`,
  '나무 추가': `${ICON_BASE}/tree.svg`,
  '배경 흐리게': `${ICON_BASE}/blur-radial.svg`,
  '조명 보정': `${ICON_BASE}/lightbulb-on.svg`,
  '피부 보정': `${ICON_BASE}/face-woman.svg`,
  '색감 보정': `${ICON_BASE}/palette.svg`,
  '구도 보정': `${ICON_BASE}/crop.svg`,
  '인물 강조': `${ICON_BASE}/account.svg`,
  '잡티 제거': `${ICON_BASE}/eraser.svg`,
  '밝기 보정': `${ICON_BASE}/brightness-6.svg`,
};

export function resolveEnhancementIconUrl(type: string): string {
  return ENHANCEMENT_ICON_MAP[type] ?? DEFAULT_ENHANCEMENT_ICON_URL;
}
