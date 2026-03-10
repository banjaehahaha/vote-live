/**
 * Presentation scene 자산(이미지/영상) preload / warm-up.
 * scene 전환 시 체감 로딩을 줄이기 위해 다음·다다음 장면 자산을 백그라운드에서 미리 요청.
 */

import type { PresentationScene } from "@/lib/presentation-scenes";

/** scene에서 참조하는 모든 미디어 URL 수집 (이미지 + 영상) */
export function getSceneAssetUrls(scene: PresentationScene | null): { images: string[]; videos: string[] } {
  const images: string[] = [];
  const videos: string[] = [];

  if (!scene) return { images, videos };

  if (scene.images?.length) {
    for (const src of scene.images) if (src) images.push(src);
  }
  if (scene.video) videos.push(scene.video);

  const flow = scene.flowDiagram;
  if (flow) {
    if (flow.topImage) images.push(flow.topImage);
    if (flow.diagramImage) images.push(flow.diagramImage);
  }

  const twoCol = scene.twoColumns;
  if (twoCol) {
    if (twoCol.leftImages?.length) for (const src of twoCol.leftImages) if (src) images.push(src);
    if (twoCol.rightImages?.length) for (const src of twoCol.rightImages) if (src) images.push(src);
  }

  return { images, videos };
}

/** 이미지 preload: Image 객체로 로드해 브라우저 캐시에 적재. 이미 preloaded Set에 있으면 스킵. */
function preloadImage(url: string, preloaded: Set<string>): void {
  if (typeof window === "undefined" || !url) return;
  const key = url;
  if (preloaded.has(key)) return;
  preloaded.add(key);
  try {
    const img = new window.Image();
    img.src = url.startsWith("/") ? `${window.location.origin}${url}` : url;
  } catch {
    preloaded.delete(key);
  }
}

/** 영상 preload: video 요소에 src만 넣고 preload="metadata"로 메타/일부 데이터만 요청. 재생하지 않음. */
function preloadVideo(url: string, preloaded: Set<string>): void {
  if (typeof window === "undefined" || !url) return;
  const key = url;
  if (preloaded.has(key)) return;
  preloaded.add(key);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url.startsWith("/") ? `${window.location.origin}${url}` : url;
    video.load();
  } catch {
    preloaded.delete(key);
  }
}

/**
 * 한 scene의 이미지/영상을 preload.
 * preloaded Set에 기록해 같은 URL 중복 요청을 막음.
 */
export function preloadSceneAssets(
  scene: PresentationScene | null,
  preloaded: Set<string>
): void {
  if (!scene) return;
  const { images, videos } = getSceneAssetUrls(scene);
  for (const url of images) preloadImage(url, preloaded);
  for (const url of videos) preloadVideo(url, preloaded);
}
