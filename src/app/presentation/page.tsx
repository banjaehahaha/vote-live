"use client";

import React from "react";
/**
 * Presentation page: 발표자용 풀스크린 플로우.
 * - intro: full-bleed 배경(01_intro_02.png), 클릭/Enter → vote
 * - vote: vote-stage-screen, 질문 3줄, 타이머, QR 280x280, 하단 4항목(2x2), 투표 시작/종료/결과 확정, 직접 설정, mute, Plan B
 * - locked-result: 동일 배경, 최종 순위 헤더, 1~4위+배정 분, 발표 시작 버튼, 애니메이션
 * - present-existing-works: 상단 레일 52px, scene 콘텐츠(renderSceneByTemplate), 키보드 ←/→/N, 디버그
 * - presentation-viewport 래퍼, body.presentation-active, baseStyle height 100% overflow hidden
 */

import {
  ALLOCATION_SECONDS,
  CHOICE_LABELS,
  CHOICE_WORK_TITLES,
  getRankedChoicesFromCounts,
} from "@/lib/presentation-config";
import { preloadSceneAssets } from "@/lib/presentation-preload";
import { getScenesForChoice, RESIDENCY_PLAN_SCENES, type PresentationScene } from "@/lib/presentation-scenes";
import type { VoteChoice } from "@/lib/validation";
import {
  clearPresentationSnapshot,
  getSnapshotForSid,
  savePresentationSnapshot,
  type AllocationsMs,
  type CountsSnapshot,
  type PresentationSnapshot,
  type PresentationStage,
  type RankedChoices,
} from "@/lib/presentation-storage";
import { isValidSid } from "@/lib/validation";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  Suspense,
} from "react";

// ---------- Constants ----------
const DEFAULT_SID = "test-0311";
const PRESENT_TOP_RAIL_HEIGHT = 52;

/** 이미지 로드 실패 시 회색 박스 (placeholder/없는 파일 대응, 파일명 미표시) */
function SceneImageFallback({
  src,
  alt = "",
  style = {},
}: {
  src: string;
  alt?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          minHeight: 0,
          background: "rgba(60,60,60,0.35)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "block",
          ...style,
        }}
        aria-hidden
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain", display: "block", ...style }}
      onError={() => setFailed(true)}
    />
  );
}

/** 프레젠테이션용 타이포: 제목 36~64px, 본문 20~28px, 라벨 14~18px */
const PRESENT_TITLE_STYLE: React.CSSProperties = {
  fontSize: "clamp(36px, 4.5vw, 64px)",
  fontWeight: 700,
  lineHeight: 1.2,
  color: "rgba(255,255,255,0.95)",
  marginBottom: "0.5em",
};
const PRESENT_BODY_STYLE: React.CSSProperties = {
  fontSize: "clamp(20px, 2.2vw, 28px)",
  lineHeight: 1.45,
  color: "rgba(255,255,255,0.9)",
  marginBottom: "0.6em",
};
const PRESENT_LABEL_STYLE: React.CSSProperties = {
  fontSize: "clamp(14px, 1.2vw, 18px)",
  opacity: 0.8,
  marginBottom: "0.35em",
};

/** scene 루트: viewport 안에 fit, 스크롤 없음 (flex로 남은 높이 채움 + overflow hidden) */
const SCENE_FIT_ROOT: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

/** 단일/다중 이미지 공통: 부모 높이 안에 contain, 스크롤 없음 */
const singleImgStyle: React.CSSProperties = {
  maxWidth: "100%",
  width: "auto",
  maxHeight: "100%",
  height: "auto",
  objectFit: "contain",
  display: "block",
};
const multiImgStyle: React.CSSProperties = {
  maxWidth: "100%",
  width: "auto",
  maxHeight: "100%",
  objectFit: "contain",
  display: "block",
};

/** 템플릿별 scene 콘텐츠 렌더 (A/B/C/D) — 관객용 큰 타이포·이미지 중심. 스크롤 없이 viewport 안에 fit. */
function renderSceneByTemplate(scene: PresentationScene, sceneRevealIndex = 0) {
  const t = scene.template;
  const images = scene.images?.length ? scene.images : [];

  const centerReplaceSteps = scene.centerReplaceSteps;
  if (centerReplaceSteps?.length) {
    const idx = Math.max(0, Math.min(sceneRevealIndex, centerReplaceSteps.length - 1));
    const text = centerReplaceSteps[idx];
    return (
      <div style={{ ...SCENE_FIT_ROOT, justifyContent: "center", alignItems: "center" }}>
        <p
          key={idx}
          className="present-reveal-step"
          style={{
            margin: 0,
            fontSize: "clamp(48px, 8vw, 120px)",
            fontWeight: 700,
            lineHeight: 1.2,
            color: "rgba(255,255,255,0.95)",
            textAlign: "center",
            whiteSpace: "pre-line",
          }}
        >
          {text}
        </p>
      </div>
    );
  }

  const threeColumn = scene.threeColumnReveal;
  if (threeColumn?.columns?.length) {
    const showReveal = sceneRevealIndex >= 1;
    return (
      <div style={{ ...SCENE_FIT_ROOT, justifyContent: "center", alignItems: "center" }}>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: "100%", padding: "1rem" }}>
          <h2 style={{ ...PRESENT_TITLE_STYLE, flexShrink: 0, textAlign: "center", marginBottom: "2.5rem" }}>
            {threeColumn.mainTitle}
          </h2>
          <div
            style={{
              display: "grid",
              marginTop: "0.5rem",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "clamp(1.5rem, 3vw, 2.5rem)",
              width: "100%",
              maxWidth: "100%",
            }}
          >
            {threeColumn.columns.map((col: { title: string; body: string; revealText?: string }, i: number) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", minHeight: 0, textAlign: "center", alignItems: "center" }}>
                <h3 style={{ ...PRESENT_TITLE_STYLE, fontSize: "clamp(28px, 3vw, 42px)", flexShrink: 0, marginBottom: "0.5rem" }}>
                  {col.title}
                </h3>
<p style={{ ...PRESENT_BODY_STYLE, flexShrink: 0, marginBottom: showReveal && col.revealText ? "1.25rem" : 0, whiteSpace: "pre-line" }}>
                {col.body}
              </p>
                {showReveal && col.revealText && (
                  <p
                    key={`reveal-${i}`}
                    className="present-reveal-step"
                    style={{
                      margin: 0,
                      marginTop: "0.5rem",
                      fontSize: "clamp(36px, 4vw, 56px)",
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.95)",
                      textAlign: "center",
                    }}
                  >
                    {col.revealText}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const splitText = scene.splitText;
  if (splitText) {
    const bigTextStyle: React.CSSProperties = {
      margin: 0,
      fontSize: "clamp(48px, 8vw, 120px)",
      fontWeight: 700,
      lineHeight: 1.2,
      color: "rgba(255,255,255,0.95)",
      textAlign: "center",
    };
    return (
      <div style={{ ...SCENE_FIT_ROOT, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0, overflow: "hidden" }}>
          <span style={bigTextStyle}>{splitText.left}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0, overflow: "hidden" }}>
          <span style={bigTextStyle}>{splitText.right}</span>
        </div>
      </div>
    );
  }

  const flowDiagram = scene.flowDiagram;
  if (flowDiagram) {
    if (flowDiagram.diagramImage) {
      return (
        <div style={SCENE_FIT_ROOT}>
          {flowDiagram.topImage && (
            <div style={{ flexShrink: 0, flex: "0 0 auto", minHeight: "38vh", maxHeight: "55%", display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "1rem" }}>
              <SceneImageFallback src={flowDiagram.topImage} style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain" }} />
            </div>
          )}
          <div style={{ flex: 1, minHeight: "min(200px, 25vh)", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", padding: "0.5rem" }}>
            {flowDiagram.diagramImage.endsWith(".svg") ? (
              <object
                data={flowDiagram.diagramImage}
                type="image/svg+xml"
                aria-label=""
                style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain" }}
              />
            ) : (
              <SceneImageFallback
                src={flowDiagram.diagramImage}
                alt=""
                style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain" }}
              />
            )}
          </div>
        </div>
      );
    }
    if (flowDiagram.steps?.length) {
      const steps = flowDiagram.steps;
      const stepStyle: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minWidth: 0, flex: "1 1 0" };
      const mainLabelStyle: React.CSSProperties = { margin: 0, fontSize: "clamp(20px, 2.2vw, 32px)", fontWeight: 700, color: "rgba(255,255,255,0.95)" };
      const titleStyle: React.CSSProperties = { margin: 0, marginBottom: "0.25rem", fontSize: "clamp(11px, 1.1vw, 14px)", fontWeight: 500, color: "rgba(255,255,255,0.9)" };
      const detailsStyle: React.CSSProperties = { margin: 0, fontSize: "clamp(10px, 1vw, 12px)", color: "rgba(255,255,255,0.6)" };
      const arrowStyle: React.CSSProperties = { flexShrink: 0, fontSize: "clamp(18px, 2vw, 28px)", color: "rgba(255,255,255,0.7)", alignSelf: "center" };
      return (
        <div style={SCENE_FIT_ROOT}>
          {flowDiagram.topImage && (
            <div style={{ flexShrink: 0, minHeight: 0, flex: "0 0 auto", maxHeight: "40%", display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "1rem" }}>
              <SceneImageFallback src={flowDiagram.topImage} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap", width: "100%" }}>
              {steps.map((step: { mainLabel: string; title: string; details: string }, i: number) => (
                <React.Fragment key={i}>
                  <div style={stepStyle}>
                    <p style={titleStyle}>{step.title}</p>
                    <p style={mainLabelStyle}>{step.mainLabel}</p>
                    <p style={detailsStyle}>{step.details}</p>
                  </div>
                  {i < steps.length - 1 && <span style={arrowStyle}>→</span>}
                </React.Fragment>
              ))}
            </div>
            <div style={{ marginTop: "1.5rem", display: "flex", alignItems: "flex-start", justifyContent: "center", width: "100%", maxWidth: "100%" }}>
              <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: "clamp(14px, 1.8vw, 22px)", color: "rgba(255,255,255,0.75)", marginBottom: "2px" }}>↑</span>
                <div style={{ width: "2px", height: "22px", background: "rgba(255,255,255,0.55)" }} />
              </div>
              <div style={{ flex: "8 1 0", minWidth: 0, height: "24px", marginTop: "22px", borderTop: "2px solid rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "clamp(14px, 1.8vw, 22px)", color: "rgba(255,255,255,0.75)" }}>←</span>
              </div>
              <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: "2px", height: "22px", background: "rgba(255,255,255,0.55)" }} />
                <span style={{ fontSize: "clamp(14px, 1.8vw, 22px)", color: "rgba(255,255,255,0.75)", marginTop: "2px" }}>↓</span>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  if (t === "title_anchor") {
    return (
      <div style={SCENE_FIT_ROOT}>
        {scene.label && <p style={{ ...PRESENT_LABEL_STYLE, flexShrink: 0 }}>{scene.label}</p>}
        {scene.title && <h2 style={{ ...PRESENT_TITLE_STYLE, flexShrink: 0 }}>{scene.title}</h2>}
        {scene.subtitle && (
          <p style={{ ...PRESENT_BODY_STYLE, fontSize: "clamp(20px, 2vw, 26px)", flexShrink: 0 }}>{scene.subtitle}</p>
        )}
        {(scene.video || images.length > 0) && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
              marginTop: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            {scene.video ? (
              <video
                src={scene.video}
                autoPlay
                muted
                loop
                playsInline
                style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain" }}
              />
            ) : (
              images.slice(0, 2).map((src: string, i: number) => (
                <SceneImageFallback key={i} src={src} style={images.length === 1 ? singleImgStyle : multiImgStyle} />
              ))
            )}
          </div>
        )}
        {(scene.body || scene.paragraphs?.length) && (
          <div style={{ flexShrink: 0 }}>
            {scene.body && <p style={PRESENT_BODY_STYLE}>{scene.body}</p>}
            {scene.paragraphs?.map((p: string, i: number) => (
              <p key={i} style={PRESENT_BODY_STYLE}>{p}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (t === "images_top_highlight_bottom") {
    const topImages = images.slice(0, 3);
    return (
      <div style={SCENE_FIT_ROOT}>
        {scene.title && <h2 style={{ ...PRESENT_TITLE_STYLE, flexShrink: 0 }}>{scene.title}</h2>}
        {topImages.length > 0 && (
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "clamp(0.75rem, 1.5vw, 1.25rem)",
              minHeight: 0,
              flex: "1 1 auto",
            }}
          >
            {topImages.map((src: string, i: number) => (
              <div key={i} style={{ flex: 1, minWidth: 0, maxWidth: "33%", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <SceneImageFallback src={src} style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain" }} />
              </div>
            ))}
          </div>
        )}
        {scene.subtitle && (
          <p
            style={{
              flexShrink: 0,
              margin: 0,
              marginTop: "0.25rem",
              textAlign: "center",
              fontSize: "clamp(40px, 6vw, 72px)",
              fontWeight: 700,
              color: "rgba(255,255,255,0.95)",
              letterSpacing: "0.02em",
            }}
          >
            {scene.subtitle}
          </p>
        )}
      </div>
    );
  }

  if (t === "process_flow") {
    const revealSteps = scene.revealSteps;
    if (revealSteps?.length) {
      const gridCellStyle: React.CSSProperties = {
        minHeight: 0,
        minWidth: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      };
      return (
        <div style={SCENE_FIT_ROOT}>
          {scene.video ? (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <video
                src={scene.video}
                autoPlay
                muted
                loop
                playsInline
                style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain" }}
              />
            </div>
          ) : images.length > 0 ? (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: "1fr 1fr",
                gap: "1rem",
              }}
            >
              {images.slice(0, 4).map((src: string, i: number) => (
                <div key={i} style={gridCellStyle}>
                  <SceneImageFallback src={src} style={{ ...multiImgStyle, width: "100%", height: "100%" }} />
                </div>
              ))}
            </div>
          ) : null}
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "clamp(1rem, 2vw, 2rem)",
              paddingTop: "1rem",
              paddingBottom: "0.5rem",
            }}
          >
            {revealSteps.slice(0, sceneRevealIndex + 1).map((text: string, i: number) => (
              <span key={i} className="present-reveal-step" style={{ ...PRESENT_BODY_STYLE, marginBottom: 0, fontSize: "clamp(42px, 5vw, 72px)", fontWeight: 600 }}>
                {text}
              </span>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div style={SCENE_FIT_ROOT}>
        {scene.label && <p style={{ ...PRESENT_LABEL_STYLE, flexShrink: 0 }}>{scene.label}</p>}
        {scene.title && <h2 style={{ ...PRESENT_TITLE_STYLE, fontSize: "clamp(32px, 3.5vw, 52px)", flexShrink: 0 }}>{scene.title}</h2>}
        {scene.body && <p style={{ ...PRESENT_BODY_STYLE, flexShrink: 0 }}>{scene.body}</p>}
        {scene.paragraphs?.map((p: string, i: number) => (
          <p key={i} style={{ ...PRESENT_BODY_STYLE, flexShrink: 0 }}>{p}</p>
        ))}
        {images.length > 0 && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
              alignItems: "center",
              alignContent: "center",
            }}
          >
            {images.slice(0, 3).map((src: string, i: number) => (
              <SceneImageFallback key={i} src={src} style={{ ...multiImgStyle, flex: "1 1 200px" }} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (t === "compare_split") {
    const leftImages = images.slice(0, 6);
    const rightImages = images.slice(6, 10);
    const leftCellStyle: React.CSSProperties = { minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" };
    const rightCellStyle: React.CSSProperties = { minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" };
    return (
      <div style={SCENE_FIT_ROOT}>
        {scene.title && <h2 style={{ ...PRESENT_TITLE_STYLE, fontSize: "clamp(32px, 3.5vw, 52px)", flexShrink: 0 }}>{scene.title}</h2>}
        {scene.paragraphs?.length ? (
          <div style={{ flexShrink: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "0.75rem" }}>
            {scene.paragraphs.slice(0, 2).map((p: string, i: number) => (
              <p key={i} style={{ ...PRESENT_BODY_STYLE, borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: "0.4em", marginBottom: 0 }}>{p}</p>
            ))}
          </div>
        ) : null}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            alignContent: "center",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr 1fr", gap: "0.5rem", minHeight: 0 }}>
            {leftImages.map((src: string, i: number) => (
              <div key={i} style={leftCellStyle}>
                <SceneImageFallback src={src} style={{ ...multiImgStyle, width: "100%", height: "100%" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "0.5rem", minHeight: 0 }}>
            {rightImages.map((src: string, i: number) => (
              <div key={i} style={rightCellStyle}>
                <SceneImageFallback src={src} style={{ ...multiImgStyle, width: "100%", height: "100%" }} />
              </div>
            ))}
          </div>
        </div>
        {scene.body && <p style={{ ...PRESENT_BODY_STYLE, flexShrink: 0, marginTop: "0.5rem" }}>{scene.body}</p>}
      </div>
    );
  }

  if (t === "commentary_method") {
    const captions = scene.captions ?? [];
    const showCaptions = captions.length >= 1 && images.length >= 1;
    return (
      <div style={SCENE_FIT_ROOT}>
        {scene.title && <h2 style={{ ...PRESENT_TITLE_STYLE, flexShrink: 0 }}>{scene.title}</h2>}
        {scene.body && <p style={{ ...PRESENT_BODY_STYLE, flexShrink: 0 }}>{scene.body}</p>}
        {scene.paragraphs?.map((p: string, i: number) => (
          <p key={i} style={{ ...PRESENT_BODY_STYLE, flexShrink: 0 }}>{p}</p>
        ))}
        {scene.meta && <p style={{ ...PRESENT_LABEL_STYLE, flexShrink: 0 }}>{scene.meta}</p>}
        {images.length > 0 && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "1rem",
              alignContent: "center",
              marginTop: "0.5rem",
            }}
          >
            {images.slice(0, 3).map((src: string, i: number) => (
              <div key={i} style={{ minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
                  <SceneImageFallback src={src} style={{ ...multiImgStyle, width: "100%", height: "100%" }} />
                </div>
                {showCaptions && captions[i] != null && (
                  <>
                    <p style={{ ...PRESENT_BODY_STYLE, flexShrink: 0, marginTop: "0.75rem", marginBottom: 0, textAlign: "center", fontSize: "clamp(16px, 1.8vw, 24px)" }}>
                      {captions[i]}
                    </p>
                    {scene.captionSubs?.[i] != null && (
                      <p style={{ ...PRESENT_BODY_STYLE, flexShrink: 0, marginTop: "0.25rem", marginBottom: 0, textAlign: "center", fontSize: "clamp(14px, 1.4vw, 18px)", opacity: 0.88 }}>
                        {scene.captionSubs[i]}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const sixCol = scene.sixColumnVariables;
  if (sixCol?.columns?.length) {
    const colStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: 0 };
    const varStyle: React.CSSProperties = { margin: 0, fontSize: "clamp(11px, 1.1vw, 14px)", lineHeight: 1.35, color: "rgba(255,255,255,0.9)" };
    const cycleStyle: React.CSSProperties = { margin: 0, fontSize: "clamp(10px, 1vw, 12px)", color: "rgba(255,255,255,0.65)", marginTop: "0.15rem" };
    return (
      <div style={SCENE_FIT_ROOT}>
        <div
          style={{
            flexShrink: 0,
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: "clamp(0.5rem, 1.2vw, 1rem)",
            marginBottom: "1rem",
            paddingBottom: "0.75rem",
            borderBottom: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {sixCol.columns.map((col: { title: string; variables: { id: string; title: string; description: string; cycle: string }[] }, ci: number) => (
            <div key={ci} style={colStyle}>
              <h3 style={{ margin: 0, marginBottom: "0.4rem", fontSize: "clamp(14px, 1.5vw, 20px)", fontWeight: 600, color: "rgba(255,255,255,0.95)" }}>
                {col.title}
              </h3>
              {col.variables.map((v: { id: string; title: string; description: string; cycle: string }, vi: number) => (
                <div key={vi} style={{ marginBottom: "0.5rem" }}>
                  <p style={{ ...varStyle, fontWeight: 600 }}>{v.id} - {v.title}</p>
                  <p style={{ ...varStyle, fontWeight: 400, opacity: 0.9 }}>{v.description}</p>
                  <p style={cycleStyle}>수집 주기: {v.cycle}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
        {(scene.video || images.length > 0) && (
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center" }}>
            {scene.video ? (
              <video
                src={scene.video}
                autoPlay
                muted
                loop
                playsInline
                style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain" }}
              />
            ) : (
              <SceneImageFallback src={images[0]} style={{ ...singleImgStyle, maxHeight: "100%", width: "auto" }} />
            )}
          </div>
        )}
      </div>
    );
  }

  if (t === "left_image_right_video") {
    const leftImage = images[0];
    const cellStyle: React.CSSProperties = { minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" };
    return (
      <div style={SCENE_FIT_ROOT}>
        {scene.title && <h2 style={{ ...PRESENT_TITLE_STYLE, flexShrink: 0 }}>{scene.title}</h2>}
        {scene.body && <p style={{ ...PRESENT_BODY_STYLE, flexShrink: 0 }}>{scene.body}</p>}
        {(leftImage || scene.video) && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              alignContent: "stretch",
            }}
          >
            {leftImage && (
              <div style={cellStyle}>
                <SceneImageFallback src={leftImage} style={{ ...multiImgStyle, width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
            )}
            {scene.video && (
              <div style={cellStyle}>
                <video
                  src={scene.video}
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (t === "left_images_right_video") {
    const leftImages = images.slice(0, 2);
    const cellStyle: React.CSSProperties = { minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" };
    return (
      <div style={SCENE_FIT_ROOT}>
        {scene.title && <h2 style={{ ...PRESENT_TITLE_STYLE, flexShrink: 0 }}>{scene.title}</h2>}
        {scene.body && <p style={{ ...PRESENT_BODY_STYLE, flexShrink: 0 }}>{scene.body}</p>}
        {(leftImages.length > 0 || scene.video) && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              alignContent: "stretch",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", gap: "0.5rem" }}>
              {leftImages.map((src: string, i: number) => (
                <div key={i} style={{ ...cellStyle, flex: 1 }}>
                  <SceneImageFallback src={src} style={{ ...multiImgStyle, width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              ))}
            </div>
            {scene.video && (
              <div style={cellStyle}>
                <video
                  src={scene.video}
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (t === "left_right_images") {
    const leftImages = images.slice(0, 2);
    const rightImage = images[2];
    const cellStyle: React.CSSProperties = { minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" };
    return (
      <div style={SCENE_FIT_ROOT}>
        {scene.title && <h2 style={{ ...PRESENT_TITLE_STYLE, flexShrink: 0 }}>{scene.title}</h2>}
        {scene.body && <p style={{ ...PRESENT_BODY_STYLE, flexShrink: 0 }}>{scene.body}</p>}
        {images.length >= 3 && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              alignContent: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minHeight: 0 }}>
              {leftImages.map((src: string, i: number) => (
                <div key={i} style={{ ...cellStyle, flex: 1 }}>
                  <SceneImageFallback src={src} style={{ ...multiImgStyle, width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              ))}
            </div>
            <div style={cellStyle}>
              <SceneImageFallback src={rightImage} style={{ ...multiImgStyle, width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const twoColImgCap = scene.twoColumnsImageCaption;
  if (twoColImgCap) {
    const colCellStyle: React.CSSProperties = { minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" };
    return (
      <div style={SCENE_FIT_ROOT}>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "clamp(1rem, 2vw, 1.5rem)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            <div style={{ ...colCellStyle, flex: 1 }}>
              <SceneImageFallback src={twoColImgCap.leftImage} style={{ ...multiImgStyle, width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <p style={{ ...PRESENT_BODY_STYLE, flexShrink: 0, marginTop: "0.5rem", marginBottom: 0, textAlign: "center", whiteSpace: "pre-line" }}>
              {twoColImgCap.leftCaption}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            <div style={{ ...colCellStyle, flex: 1 }}>
              <SceneImageFallback src={twoColImgCap.rightImage} style={{ ...multiImgStyle, width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <p style={{ ...PRESENT_BODY_STYLE, flexShrink: 0, marginTop: "0.5rem", marginBottom: 0, textAlign: "center", whiteSpace: "pre-line" }}>
              {twoColImgCap.rightCaption}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const twoCol = scene.twoColumns;
  if (twoCol) {
    const colCellStyle: React.CSSProperties = { minHeight: 0, minWidth: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" };
    return (
      <div style={SCENE_FIT_ROOT}>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "clamp(1rem, 2vw, 1.5rem)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            {twoCol.leftTitle ? (
              <h2 style={{ ...PRESENT_TITLE_STYLE, flexShrink: 0, marginBottom: "0.5rem", fontSize: "clamp(24px, 2.5vw, 36px)", textAlign: "center" }}>
                {twoCol.leftTitle}
              </h2>
            ) : null}
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {twoCol.leftImages.slice(0, 3).map((src: string, i: number) => (
                <div key={i} style={{ ...colCellStyle, flex: 1 }}>
                  <SceneImageFallback src={src} style={{ ...multiImgStyle, width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            {twoCol.rightTitle ? (
              <h2 style={{ ...PRESENT_TITLE_STYLE, flexShrink: 0, marginBottom: "0.5rem", fontSize: "clamp(24px, 2.5vw, 36px)", textAlign: "center" }}>
                {twoCol.rightTitle}
              </h2>
            ) : null}
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {twoCol.rightImages.slice(0, 3).map((src: string, i: number) => (
                <div key={i} style={{ ...colCellStyle, flex: 1 }}>
                  <SceneImageFallback src={src} style={{ ...multiImgStyle, width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={SCENE_FIT_ROOT}>
      {scene.title && <h2 style={{ ...PRESENT_TITLE_STYLE, flexShrink: 0 }}>{scene.title}</h2>}
      {scene.body && <p style={{ ...PRESENT_BODY_STYLE, flexShrink: 0 }}>{scene.body}</p>}
      {(scene.video || images.length > 0) && (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center" }}>
          {scene.video ? (
            <video
              src={scene.video}
              autoPlay
              muted
              loop
              playsInline
              style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain" }}
            />
          ) : (
            images.map((src: string, i: number) => (
              <SceneImageFallback key={i} src={src} style={singleImgStyle} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Polling / vote tick ----------
const POLL_INTERVAL_MS = 1000;
const BACKOFF_MS = [1000, 2000, 4000, 8000];
const VALID_CHOICES: VoteChoice[] = ["ITEM", "IMAGE", "DATA", "NEAR"];
const VOTE_TICK_MIN_INTERVAL_MS = 150;

/** 투표 시 효과음 (square wave 짧게) */
function playVoteTickSound(ctx: AudioContext): void {
  try {
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 900;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.055);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.055);
  } catch {
    /* ignore */
  }
}

/** 공통 레이아웃: 높이 100%, overflow hidden (presentation-viewport 내부) */
const baseStyle: React.CSSProperties = {
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
  padding: "2rem",
  fontFamily: "system-ui, sans-serif",
  background: "#111",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
};

/** 순위별 할당 시간(ms): 1위 180s, 2위 120s, 3위 120s, 4위 60s */
const ALLOCATIONS_MS: AllocationsMs = [
  ALLOCATION_SECONDS[1] * 1000,
  ALLOCATION_SECONDS[2] * 1000,
  ALLOCATION_SECONDS[3] * 1000,
  ALLOCATION_SECONDS[4] * 1000,
];

// ---------- PresentationContent: stage별 UI + 상태 ----------
function PresentationContent() {
  const searchParams = useSearchParams();
  const sidParam = searchParams.get("sid");
  const sid =
    sidParam && isValidSid(sidParam) ? sidParam : DEFAULT_SID;

  const [stage, setStage] = useState<PresentationStage>("setup");
  const [snapshot, setSnapshot] = useState<PresentationSnapshot | null>(null);

  const [counts, setCounts] = useState<CountsSnapshot>({
    ITEM: 0,
    IMAGE: 0,
    DATA: 0,
    NEAR: 0,
  });
  const [fetchStatus, setFetchStatus] = useState<
    "idle" | "connected" | "reconnecting" | "error"
  >("idle");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const backoffIndexRef = useRef(0);

  const [votePhase, setVotePhase] = useState<"idle" | "running" | "closed">("idle");
  const [voteClosesAt, setVoteClosesAt] = useState<number | null>(null);
  const [voteRemainingMs, setVoteRemainingMs] = useState<number | null>(null);
  const voteTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [planBOpen, setPlanBOpen] = useState(false);
  const [manualRank, setManualRank] = useState<(VoteChoice | null)[]>([
    null,
    null,
    null,
    null,
  ]);

  const [currentWorkIndex, setCurrentWorkIndex] = useState(0);
  const [sceneIndex, setSceneIndex] = useState(0);
  /** 레지던시 계획 단계에서 현재 장면 인덱스 (0~4) */
  const [residencySceneIndex, setResidencySceneIndex] = useState(0);
  /** process_flow의 revealSteps에서 우측 화살표로 공개한 개수 (0~revealSteps.length-1). 장면/작업 바뀌면 0으로 리셋 */
  const [sceneRevealIndex, setSceneRevealIndex] = useState(0);
  const [timerStatus, setTimerStatus] = useState<
    "idle" | "running" | "paused" | "ended"
  >("idle");
  const [targetTime, setTargetTime] = useState<number | null>(null);
  const [pausedRemainingMs, setPausedRemainingMs] = useState<number | null>(
    null
  );
  const [displayRemainingMs, setDisplayRemainingMs] = useState<number | null>(
    null
  );
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voteStageAnimDoneRef = useRef(false);
  const [voteStageAnimReady, setVoteStageAnimReady] = useState(false);
  const lockedResultAnimDoneRef = useRef(false);
  const [lockedResultAnimReady, setLockedResultAnimReady] = useState(false);

  const prevTotalRef = useRef(0);
  const lastVoteTickAtRef = useRef(0);
  const votePhaseRef = useRef<"idle" | "running" | "closed">("idle");
  const audioContextRef = useRef<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = sessionStorage.getItem("vote-live-sound-enabled");
    return stored !== "0";
  });
  const soundEnabledRef = useRef(soundEnabled);
  /** preload한 자산 URL (중복 요청 방지) */
  const preloadedUrlsRef = useRef<Set<string>>(new Set());
  /** present-existing-works에서 warm-up한 work 인덱스 */
  const warmUpWorkIndexRef = useRef<number | null>(null);
  /** residency-plan 진입 시 warm-up 완료 여부 */
  const residencyWarmedUpRef = useRef(false);

  /* /presentation 전용: body 스크롤 차단 (다른 페이지로 나가면 해제) */
  useEffect(() => {
    document.body.classList.add("presentation-active");
    return () => {
      document.body.classList.remove("presentation-active");
    };
  }, []);

  useEffect(() => {
    votePhaseRef.current = votePhase;
  }, [votePhase]);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    if (typeof window !== "undefined") sessionStorage.setItem("vote-live-sound-enabled", soundEnabled ? "1" : "0");
  }, [soundEnabled]);

  /** /api/state 폴링: counts, voteSession(phase, closesAt) 반영. vote 단계에서만 연속 폴링. */
  const fetchState = useCallback(async (): Promise<boolean> => {
    if (!sid || !isValidSid(sid)) return false;
    try {
      const res = await fetch(`/api/state?sid=${encodeURIComponent(sid)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (mountedRef.current) {
        const newCounts = data.counts ?? { ITEM: 0, IMAGE: 0, DATA: 0, NEAR: 0 };
        const newTotal =
          newCounts.ITEM + newCounts.IMAGE + newCounts.DATA + newCounts.NEAR;
        if (
          votePhaseRef.current === "running" &&
          newTotal > prevTotalRef.current &&
          soundEnabledRef.current &&
          Date.now() - lastVoteTickAtRef.current >= VOTE_TICK_MIN_INTERVAL_MS
        ) {
          const ctx = audioContextRef.current;
          if (ctx?.state === "running") {
            playVoteTickSound(ctx);
            lastVoteTickAtRef.current = Date.now();
          }
        }
        prevTotalRef.current = newTotal;
        setCounts(newCounts);
        setLastUpdated(new Date());
        setFetchStatus("connected");
        backoffIndexRef.current = 0;
        const vs = data.voteSession;
        if (vs) {
          let phase = vs.phase === "running" || vs.phase === "closed" ? vs.phase : "idle";
          const closesAt = typeof vs.closesAt === "number" ? vs.closesAt : null;
          if (phase === "running" && closesAt != null && closesAt <= Date.now()) {
            phase = "closed";
            fetch(`/api/vote-session`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sid, action: "close" }),
            }).catch(() => {});
          }
          setVotePhase(phase);
          setVoteClosesAt(phase === "running" ? closesAt : null);
        }
      }
      return true;
    } catch {
      if (mountedRef.current) {
        const next = Math.min(
          backoffIndexRef.current + 1,
          BACKOFF_MS.length - 1
        );
        backoffIndexRef.current = next;
        setFetchStatus(next >= BACKOFF_MS.length - 1 ? "error" : "reconnecting");
      }
      return false;
    }
  }, [sid]);

  useEffect(() => {
    mountedRef.current = true;
    const existing = getSnapshotForSid(sid);
    if (existing && existing.currentStage !== "setup" && existing.currentStage !== "intro" && existing.currentStage !== "vote") {
      setSnapshot(existing);
      setStage(existing.currentStage);
      setCurrentWorkIndex(existing.currentWorkIndex);
      setSceneIndex(existing.sceneIndex ?? 0);
      setTimerStatus(existing.timerStatus);
      setPausedRemainingMs(existing.pausedRemainingMs);
      if (existing.timerStatus === "running" && existing.pausedRemainingMs != null) {
        setTargetTime(Date.now() + existing.pausedRemainingMs);
      } else {
        setTargetTime(existing.targetTime);
      }
    }
    return () => {
      mountedRef.current = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [sid]);

  useEffect(() => {
    if (stage !== "vote" || !sid || !isValidSid(sid)) return;
    let cancelled = false;
    const run = () => {
      if (cancelled || !mountedRef.current) return;
      fetchState().then((ok) => {
        if (cancelled || !mountedRef.current) return;
        const delay = ok ? POLL_INTERVAL_MS : BACKOFF_MS[backoffIndexRef.current];
        pollTimeoutRef.current = setTimeout(run, delay);
      });
    };
    run();
    const onVis = () => {
      if (document.visibilityState === "visible" && mountedRef.current)
        fetchState();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [stage, sid, fetchState]);

  useEffect(() => {
    if (stage !== "vote" || votePhase !== "running" || voteClosesAt == null) {
      if (voteTickRef.current) {
        clearInterval(voteTickRef.current);
        voteTickRef.current = null;
      }
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, voteClosesAt - Date.now());
      setVoteRemainingMs(remaining);
      if (remaining <= 0 && mountedRef.current) {
        if (voteTickRef.current) {
          clearInterval(voteTickRef.current);
          voteTickRef.current = null;
        }
        fetch(`/api/vote-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sid, action: "close" }),
        }).catch(() => {});
        setVotePhase("closed");
        setVoteClosesAt(null);
        setVoteRemainingMs(0);
      }
    };
    tick();
    voteTickRef.current = setInterval(tick, 200);
    return () => {
      if (voteTickRef.current) {
        clearInterval(voteTickRef.current);
        voteTickRef.current = null;
      }
    };
  }, [stage, votePhase, voteClosesAt, sid]);

  useEffect(() => {
    if (stage !== "vote" || voteStageAnimDoneRef.current) return;
    let cancelled = false;
    let id2: number | null = null;
    const id1 = requestAnimationFrame(() => {
      if (cancelled) return;
      id2 = requestAnimationFrame(() => {
        if (cancelled) return;
        setVoteStageAnimReady(true);
        voteStageAnimDoneRef.current = true;
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id1);
      if (id2 != null) cancelAnimationFrame(id2);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== "locked-result") {
      lockedResultAnimDoneRef.current = false;
      setLockedResultAnimReady(false);
      return;
    }
    if (lockedResultAnimDoneRef.current) return;
    let cancelled = false;
    let id2: number | null = null;
    const id1 = requestAnimationFrame(() => {
      if (cancelled) return;
      id2 = requestAnimationFrame(() => {
        if (cancelled) return;
        setLockedResultAnimReady(true);
        lockedResultAnimDoneRef.current = true;
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id1);
      if (id2 != null) cancelAnimationFrame(id2);
    };
  }, [stage]);

  useEffect(() => {
    if (timerStatus !== "running" || targetTime == null) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, targetTime - Date.now());
      setDisplayRemainingMs(remaining);
      if (remaining <= 0 && tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
    tick();
    tickRef.current = setInterval(tick, 200);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [timerStatus, targetTime]);

  useEffect(() => {
    if (timerStatus !== "running" || targetTime == null) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, targetTime - Date.now());
      const current = getSnapshotForSid(sid);
      if (current) {
        savePresentationSnapshot({ ...current, pausedRemainingMs: remaining });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [timerStatus, targetTime, sid]);

  /** lock 이후 스냅샷 병합 후 localStorage 저장 및 state 반영 */
  const persistSnapshot = useCallback(
    (next: Partial<PresentationSnapshot>) => {
      if (!snapshot) return;
      const merged: PresentationSnapshot = {
        ...snapshot,
        ...next,
      };
      setSnapshot(merged);
      savePresentationSnapshot(merged);
    },
    [snapshot]
  );

  /** 투표 시작: /api/vote-session start → closesAt 설정 */
  const startVote = useCallback(async () => {
    if (!sid || !isValidSid(sid)) return;
    try {
      const res = await fetch("/api/vote-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid, action: "start" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.closesAt != null) {
        setVotePhase("running");
        setVoteClosesAt(data.closesAt);
        setVoteRemainingMs(Math.max(0, data.closesAt - Date.now()));
      }
    } catch {
      setVotePhase("idle");
    }
  }, [sid]);

  /** 투표 종료: /api/vote-session close */
  const endVote = useCallback(async () => {
    if (!sid || !isValidSid(sid)) return;
    try {
      await fetch("/api/vote-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid, action: "close" }),
      });
      setVotePhase("closed");
      setVoteClosesAt(null);
      setVoteRemainingMs(null);
    } catch {
      setVotePhase("closed");
    }
  }, [sid]);

  /** 다시 시작: /api/vote-session reset → 투표 초기화 후 idle로 */
  const restartVote = useCallback(async () => {
    if (!sid || !isValidSid(sid)) return;
    try {
      await fetch("/api/vote-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid, action: "reset" }),
      });
      setVotePhase("idle");
      setVoteClosesAt(null);
      setVoteRemainingMs(null);
    } catch {
      setVotePhase("idle");
    }
  }, [sid]);

  /** 결과 확정: counts 또는 수동 순위로 스냅샷 생성 후 locked-result 단계로 */
  const lockResult = useCallback(
    (countsOrManual: CountsSnapshot | RankedChoices, isManual: boolean) => {
      const ranked: RankedChoices = isManual
        ? (countsOrManual as RankedChoices)
        : getRankedChoicesFromCounts(countsOrManual as CountsSnapshot);
      const countsSnapshot: CountsSnapshot = isManual
        ? { ITEM: 0, IMAGE: 0, DATA: 0, NEAR: 0 }
        : (countsOrManual as CountsSnapshot);
      const newSnapshot: PresentationSnapshot = {
        sid,
        lockedAt: new Date().toISOString(),
        countsSnapshot,
        rankedChoices: ranked,
        allocations: ALLOCATIONS_MS,
        currentStage: "locked-result",
        currentWorkIndex: 0,
        sceneIndex: 0,
        timerStatus: "idle",
        targetTime: null,
        pausedRemainingMs: null,
      };
      setSnapshot(newSnapshot);
      savePresentationSnapshot(newSnapshot);
      setStage("locked-result");
      setPlanBOpen(false);
    },
    [sid]
  );

  /** 현재 작업 배정 시간으로 타이머 시작 */
  const startTimer = useCallback(() => {
    if (!snapshot) return;
    const alloc = snapshot.allocations[currentWorkIndex];
    const t = Date.now() + alloc;
    setTargetTime(t);
    setTimerStatus("running");
    setPausedRemainingMs(null);
    persistSnapshot({
      timerStatus: "running",
      targetTime: t,
      pausedRemainingMs: alloc,
    });
  }, [snapshot, currentWorkIndex, persistSnapshot]);

  /** 타이머 일시정지, 남은 시간을 pausedRemainingMs에 저장 */
  const pauseTimer = useCallback(() => {
    if (targetTime == null) return;
    const remaining = Math.max(0, targetTime - Date.now());
    setPausedRemainingMs(remaining);
    setTimerStatus("paused");
    setTargetTime(null);
    persistSnapshot({
      timerStatus: "paused",
      targetTime: null,
      pausedRemainingMs: remaining,
    });
  }, [targetTime, persistSnapshot]);

  /** 일시정지된 타이머 재개 */
  const resumeTimer = useCallback(() => {
    if (pausedRemainingMs == null) return;
    const t = Date.now() + pausedRemainingMs;
    setTargetTime(t);
    setTimerStatus("running");
    setPausedRemainingMs(null);
    persistSnapshot({
      timerStatus: "running",
      targetTime: t,
      pausedRemainingMs: pausedRemainingMs,
    });
  }, [pausedRemainingMs, persistSnapshot]);

  /** 다음 작업(1~4위 순서)으로 이동; 4위 다음은 residency-plan */
  const goNextWork = useCallback(() => {
    if (!snapshot) return;
    if (currentWorkIndex >= 3) {
      setStage("residency-plan");
      setResidencySceneIndex(0);
      persistSnapshot({ currentStage: "residency-plan" });
      return;
    }
    const next = currentWorkIndex + 1;
    setCurrentWorkIndex(next);
    setSceneIndex(0);
    setTimerStatus("idle");
    setTargetTime(null);
    setPausedRemainingMs(null);
    setDisplayRemainingMs(null);
    persistSnapshot({
      currentWorkIndex: next,
      sceneIndex: 0,
      timerStatus: "idle",
      targetTime: null,
      pausedRemainingMs: null,
    });
  }, [snapshot, currentWorkIndex, persistSnapshot]);

  /** 이전 작업(1~4위 순서)으로 이동 */
  const goPrevWork = useCallback(() => {
    if (!snapshot) return;
    if (stage !== "present-existing-works" || currentWorkIndex <= 0) return;
    const prev = currentWorkIndex - 1;
    setCurrentWorkIndex(prev);
    setSceneIndex(0);
    setTimerStatus("idle");
    setTargetTime(null);
    setPausedRemainingMs(null);
    setDisplayRemainingMs(null);
    persistSnapshot({
      currentWorkIndex: prev,
      sceneIndex: 0,
      timerStatus: "idle",
      targetTime: null,
      pausedRemainingMs: null,
    });
  }, [snapshot, stage, currentWorkIndex, persistSnapshot]);

  /** 현재 작업 타이머 처음부터 다시 시작 (디버그용) */
  const restartCurrent = useCallback(() => {
    if (!snapshot) return;
    const alloc = snapshot.allocations[currentWorkIndex];
    const t = Date.now() + alloc;
    setTargetTime(t);
    setTimerStatus("running");
    setPausedRemainingMs(null);
    persistSnapshot({
      timerStatus: "running",
      targetTime: t,
      pausedRemainingMs: alloc,
    });
  }, [snapshot, currentWorkIndex, persistSnapshot]);

  /** 현재 작업 타이머 종료 (디버그용) */
  const endCurrent = useCallback(() => {
    setTimerStatus("ended");
    setDisplayRemainingMs(0);
    setTargetTime(null);
    setPausedRemainingMs(0);
    persistSnapshot({
      timerStatus: "ended",
      targetTime: null,
      pausedRemainingMs: 0,
    });
  }, [persistSnapshot]);

  /** 현재 작업(choice)에 해당하는 장면 목록; presentation-scenes.ts ITEM_SCENES 등 */
  const scenes = snapshot ? getScenesForChoice(snapshot.rankedChoices[currentWorkIndex]) : [];
  const sceneCount = scenes.length;
  const safeSceneIndex = sceneCount > 0 ? Math.min(Math.max(0, sceneIndex), sceneCount - 1) : 0;
  const currentScene: PresentationScene | null = sceneCount > 0 ? scenes[safeSceneIndex]! : null;

  useEffect(() => {
    if (stage !== "present-existing-works" || sceneCount <= 0) return;
    if (sceneIndex !== safeSceneIndex) {
      setSceneIndex(safeSceneIndex);
      if (snapshot) persistSnapshot({ sceneIndex: safeSceneIndex });
    }
  }, [stage, sceneCount, sceneIndex, safeSceneIndex, snapshot, persistSnapshot]);

  /** present-existing-works: 현재 work 진입 시 첫 3장면 warm-up, 현재 장면 기준 다음·다다음 장면 preload */
  useEffect(() => {
    if (stage !== "present-existing-works" || sceneCount <= 0 || !snapshot) return;
    const list = getScenesForChoice(snapshot.rankedChoices[currentWorkIndex]);
    const preloaded = preloadedUrlsRef.current;
    if (warmUpWorkIndexRef.current !== currentWorkIndex) {
      warmUpWorkIndexRef.current = currentWorkIndex;
      for (let i = 0; i < Math.min(3, list.length); i++) {
        preloadSceneAssets(list[i] ?? null, preloaded);
      }
    }
    const next = safeSceneIndex + 1;
    const nextNext = safeSceneIndex + 2;
    if (next < list.length) preloadSceneAssets(list[next] ?? null, preloaded);
    if (nextNext < list.length) preloadSceneAssets(list[nextNext] ?? null, preloaded);
  }, [stage, sceneCount, safeSceneIndex, currentWorkIndex, snapshot]);

  /** residency-plan: 진입 시 첫 3장면 warm-up, 현재 장면 기준 다음·다다음 preload */
  useEffect(() => {
    if (stage !== "residency-plan") {
      residencyWarmedUpRef.current = false;
      return;
    }
    const preloaded = preloadedUrlsRef.current;
    if (!residencyWarmedUpRef.current) {
      residencyWarmedUpRef.current = true;
      for (let i = 0; i < Math.min(3, RESIDENCY_PLAN_SCENES.length); i++) {
        preloadSceneAssets(RESIDENCY_PLAN_SCENES[i] ?? null, preloaded);
      }
    }
    const safeResidencyIndex = Math.min(Math.max(0, residencySceneIndex), RESIDENCY_PLAN_SCENES.length - 1);
    const next = safeResidencyIndex + 1;
    const nextNext = safeResidencyIndex + 2;
    if (next < RESIDENCY_PLAN_SCENES.length) preloadSceneAssets(RESIDENCY_PLAN_SCENES[next] ?? null, preloaded);
    if (nextNext < RESIDENCY_PLAN_SCENES.length) preloadSceneAssets(RESIDENCY_PLAN_SCENES[nextNext] ?? null, preloaded);
  }, [stage, residencySceneIndex]);

  /** 이전 장면 (키보드 ArrowLeft) */
  const goPrevScene = useCallback(() => {
    if (sceneCount <= 0) return;
    const next = Math.max(0, sceneIndex - 1);
    setSceneIndex(next);
    if (snapshot) persistSnapshot({ sceneIndex: next });
  }, [sceneCount, sceneIndex, snapshot, persistSnapshot]);

  /** 다음 장면 (단순 인덱스만 증가; revealSteps는 onNextSceneOrReveal에서 처리) */
  const goNextScene = useCallback(() => {
    if (sceneCount <= 0) return;
    const next = Math.min(sceneCount - 1, sceneIndex + 1);
    setSceneIndex(next);
    if (snapshot) persistSnapshot({ sceneIndex: next });
  }, [sceneCount, sceneIndex, snapshot, persistSnapshot]);

  /** 우측 화살표/다음 장면 클릭: revealSteps·centerReplaceSteps·threeColumnReveal면 단계 진행, 끝나면 다음 장면으로 */
  const onNextSceneOrReveal = useCallback(() => {
    const steps = currentScene?.revealSteps;
    const replaceSteps = currentScene?.centerReplaceSteps;
    const threeCol = currentScene?.threeColumnReveal;
    const hasMoreReveal = steps?.length && sceneRevealIndex < steps.length - 1;
    const hasMoreReplace = replaceSteps?.length && sceneRevealIndex < replaceSteps.length - 1;
    const hasThreeColReveal = threeCol?.columns?.length && sceneRevealIndex < 1;
    if (hasMoreReveal || hasMoreReplace || hasThreeColReveal) {
      setSceneRevealIndex((i) => i + 1);
    } else {
      setSceneRevealIndex(0);
      goNextScene();
    }
  }, [currentScene?.revealSteps, currentScene?.centerReplaceSteps, currentScene?.threeColumnReveal, currentScene, sceneRevealIndex, goNextScene]);

  useEffect(() => {
    const scenes = snapshot ? getScenesForChoice(snapshot.rankedChoices[currentWorkIndex]) : [];
    const scene = sceneCount > 0 ? scenes[safeSceneIndex] ?? null : null;
    if (scene?.revealSteps?.length) setSceneRevealIndex(-1);
    else if (scene?.centerReplaceSteps?.length || scene?.threeColumnReveal?.columns?.length) setSceneRevealIndex(0);
    else setSceneRevealIndex(0);
  }, [sceneIndex, currentWorkIndex, snapshot, sceneCount, safeSceneIndex]);

  useEffect(() => {
    if (stage !== "present-existing-works" && stage !== "residency-plan") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
      if (stage === "residency-plan") {
        if (e.key === "ArrowLeft" || e.key.toLowerCase() === "p") {
          e.preventDefault();
          setResidencySceneIndex((i) => Math.max(0, i - 1));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setResidencySceneIndex((i) => {
            if (i >= RESIDENCY_PLAN_SCENES.length - 1) return i;
            return i + 1;
          });
          if (residencySceneIndex >= RESIDENCY_PLAN_SCENES.length - 1) {
            setStage("end");
            if (snapshot) persistSnapshot({ currentStage: "end" });
          }
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrevScene();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNextSceneOrReveal();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        goNextWork();
      } else if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        goPrevWork();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stage, goPrevScene, onNextSceneOrReveal, goNextWork, goPrevWork, snapshot, persistSnapshot, residencySceneIndex]);

  // ---------- Render: invalid sid ----------
  if (!sid || !isValidSid(sid)) {
    return (
      <main style={baseStyle}>
        <h1>세션(sid) 없음</h1>
        <p>URL에 세션 ID가 필요합니다. 예: /presentation?sid=test-0311</p>
      </main>
    );
  }

  // ---------- Render: setup ----------
  if (stage === "setup") {
    return (
      <main style={{ ...baseStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>발표 준비</h1>
        <p style={{ marginBottom: "0.5rem" }}>세션: {sid}</p>
        <p style={{ marginBottom: "1rem", opacity: 0.8 }}>
          네트워크 확인 후 시작하세요.
        </p>
        <button
          type="button"
          onClick={() => {
            fetchState().then(() => setStage("intro"));
          }}
          style={{
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          시작
        </button>
        <button
          type="button"
          onClick={() => setStage("intro")}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1rem",
            fontSize: "0.9rem",
            cursor: "pointer",
            opacity: 0.8,
          }}
        >
          수동 모드 (네트워크 없이 진행)
        </button>
      </main>
    );
  }

  // ---------- Render: intro (full-bleed 배경, 클릭/Enter → vote) ----------
  if (stage === "intro") {
    return (
      <main
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: "url(/01_intro_02.png)",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
        }}
        onClick={() => setStage("vote")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setStage("vote")}
        aria-label="다음으로"
      />
    );
  }

  // ---------- Render: vote (vote-stage-screen, 질문 3줄, 타이머, QR 280x280, 하단 4항목 2x2, 버튼들) ----------
  if (stage === "vote") {
    const total = counts.ITEM + counts.IMAGE + counts.DATA + counts.NEAR;
    const voteUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/v?sid=${encodeURIComponent(sid)}`
        : "";
    const voteSec = voteRemainingMs != null ? Math.ceil(voteRemainingMs / 1000) : 60;
    const voteMm = Math.floor(voteSec / 60);
    const voteSs = voteSec % 60;

    const voteQuestionLines = [
      "접근할 수 없는 곳이 있습니다.",
      "그곳에 대해 알고 싶다면,",
      "무엇을 단서로 삼겠습니까?",
    ];

    return (
      <main
        className="vote-stage-screen"
        style={{ fontFamily: "var(--font-pretendard), 'Pretendard', system-ui, sans-serif" }}
      >
        <div
          className={`vote-stage-content${voteStageAnimReady ? " vote-stage-anim-in" : ""}`}
          style={{
            position: "relative",
            height: "100vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            padding: "clamp(24px, 4vw, 48px)",
          }}
        >
          <header
            className="vote-stage-head"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 24,
              flexShrink: 0,
            }}
          >
            <div className="vote-stage-q" style={{ flex: "1 1 auto", maxWidth: "60%" }}>
              <div
                style={{
                  fontFamily: "'Pretendard', var(--font-pretendard), system-ui, sans-serif",
                  fontSize: "clamp(28px, 4.5vw, 42px)",
                  lineHeight: 1.25,
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  color: "rgba(18,18,18,0.95)",
                  wordBreak: "keep-all",
                }}
              >
                <p style={{ margin: 0, marginBottom: "0.35em" }}>{voteQuestionLines[0]}</p>
                <p style={{ margin: 0 }}>{voteQuestionLines[1]}</p>
                <p style={{ margin: 0, marginTop: "0.2em" }}>{voteQuestionLines[2]}</p>
              </div>
            </div>
            <div
              className="vote-stage-timer"
              style={{
                flexShrink: 0,
                fontFamily: "ui-monospace, monospace",
                fontSize: "clamp(48px, 6vw, 72px)",
                fontWeight: 700,
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
                color:
                  votePhase === "idle"
                    ? "rgba(18,18,18,0.5)"
                    : "rgba(18,18,18,0.95)",
              }}
            >
              {votePhase === "idle" && "01:00"}
              {votePhase === "running" && `${String(voteMm).padStart(2, "0")}:${String(voteSs).padStart(2, "0")}`}
              {votePhase === "closed" && "00:00"}
            </div>
          </header>

          <footer
            className="vote-stage-bottom"
            style={{
              flex: "1 1 auto",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minHeight: 0,
            }}
          >
            <div
              className="vote-stage-bottom-band"
              style={{
                width: "100%",
                height: 324,
                minHeight: 324,
                display: "flex",
                flexDirection: "row",
                alignItems: "stretch",
                gap: 0,
              }}
            >
              {/* 좌측: QR (배경 없음, 324px 높이에 맞춤) */}
              <div
                className="vote-stage-qr-wrap"
                style={{
                  flex: "0 0 42%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  padding: "clamp(12px, 2vw, 20px)",
                  minHeight: 0,
                }}
              >
                <div
                  className="vote-stage-qr"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      background: "rgba(252,252,250,0.95)",
                      padding: 16,
                      border: "1px solid rgba(18,18,18,0.08)",
                    }}
                  >
                    <img
                      src={`/api/presentation/qr?sid=${encodeURIComponent(sid)}`}
                      alt="투표 QR"
                      style={{ width: 280, height: 280, display: "block" }}
                    />
                  </div>
                  <p
                    style={{
                      fontSize: 10,
                      lineHeight: 1.2,
                      color: "rgba(18,18,18,0.5)",
                      margin: 0,
                      wordBreak: "break-all",
                      maxWidth: 260,
                    }}
                  >
                    {voteUrl || ""}
                  </p>
                </div>
              </div>

              {/* 우측: 4개 항목(2x2) + 버튼 (흰색 배경, QR과 동일 높이, 내용은 상단 정렬) */}
              <div
                style={{
                  flex: "1 1 58%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  background: "rgba(243,239,231,0.82)",
                  padding: "30px clamp(20px, 3vw, 28px) 14px",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gridTemplateRows: "auto auto",
                    gap: "clamp(12px, 2vw, 20px) clamp(24px, 4vw, 40px)",
                    alignContent: "start",
                  }}
                >
                  {(VALID_CHOICES as readonly VoteChoice[]).map((c) => (
                    <div
                      key={c}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        borderBottom: "1px solid rgba(18,18,18,0.12)",
                        paddingBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: "rgba(18,18,18,0.7)",
                          marginBottom: 2,
                        }}
                      >
                        {CHOICE_LABELS[c]}
                      </span>
                      <span
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 56,
                          fontWeight: 700,
                          lineHeight: 1,
                          color: "rgba(18,18,18,0.95)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {counts[c]}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 14, color: "rgba(18,18,18,0.55)" }}>
                  총 {total}표
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  {votePhase === "idle" && (
                    <button type="button" onClick={startVote} className="vote-stage-btn-main">
                      투표 시작
                    </button>
                  )}
                  {votePhase === "running" && (
                    <>
                      <button type="button" onClick={endVote} className="vote-stage-btn-main vote-stage-btn-running">
                        투표 종료
                      </button>
                      <button
                        type="button"
                        onClick={() => lockResult(counts, false)}
                        className="vote-stage-btn-main"
                      >
                        결과 확정
                      </button>
                      <button type="button" onClick={restartVote} className="vote-stage-btn-sub">
                        다시 시작
                      </button>
                    </>
                  )}
                  {votePhase === "closed" && (
                    <>
                      <button
                        type="button"
                        onClick={() => lockResult(counts, false)}
                        className="vote-stage-btn-main"
                      >
                        결과 확정
                      </button>
                      <button type="button" onClick={restartVote} className="vote-stage-btn-sub">
                        다시 시작
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => setPlanBOpen((o) => !o)} className="vote-stage-btn-sub">
                    직접 설정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!soundEnabled) {
                        const ctx = audioContextRef.current ?? new AudioContext();
                        audioContextRef.current = ctx;
                        ctx.resume();
                      }
                      setSoundEnabled((v) => !v);
                    }}
                    className="vote-stage-btn-sub"
                    style={{ fontSize: 11, padding: "6px 10px", minWidth: "auto" }}
                    title={soundEnabled ? "효과음 끄기" : "효과음 켜기"}
                  >
                    {soundEnabled ? "🔊" : "🔇"}
                  </button>
                </div>
                {planBOpen && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      paddingRight: 16,
                      paddingBottom: 12,
                      paddingLeft: 16,
                      borderTop: "1px solid rgba(18,18,18,0.1)",
                      background: "rgba(243,239,231,0.82)",
                      width: "fit-content",
                      maxWidth: "100%",
                    }}
                  >
                    {([0, 1, 2, 3] as const).map((i) => {
                      const usedElsewhere = (c: VoteChoice) =>
                        manualRank.some((val, j) => j !== i && val === c);
                      const options = VALID_CHOICES.filter(
                        (c) => c === manualRank[i] || !usedElsewhere(c)
                      );
                      return (
                        <div key={i} style={{ marginBottom: 6 }}>
                          <label>
                            <span style={{ fontSize: 13, color: "rgba(18,18,18,0.9)", marginRight: 8 }}>
                              {i + 1}위:
                            </span>
                            <select
                              value={manualRank[i] ?? ""}
                              onChange={(e) => {
                                const next = [...manualRank];
                                next[i] = e.target.value === "" ? null : (e.target.value as VoteChoice);
                                setManualRank(next);
                              }}
                              style={{
                                padding: "4px 8px",
                                fontSize: 13,
                                border: "1px solid rgba(18,18,18,0.2)",
                                background: "rgba(255,255,255,0.9)",
                                color: "rgba(18,18,18,0.95)",
                              }}
                            >
                              <option value="">선택 안 함</option>
                              {options.map((c) => (
                                <option key={c} value={c}>
                                  {CHOICE_LABELS[c]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      );
                    })}
                    {(() => {
                      const filled = manualRank.every((v) => v !== null);
                      const distinct = filled && new Set(manualRank).size === 4;
                      const canApply = filled && distinct;
                      return (
                        <button
                          type="button"
                          disabled={!canApply}
                          onClick={() => canApply && lockResult(manualRank as RankedChoices, true)}
                          style={{
                            marginTop: 10,
                            padding: "8px 14px",
                            border: "1px solid rgba(18,18,18,0.2)",
                            color: "rgba(18,18,18,0.7)",
                            background: "transparent",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: canApply ? "pointer" : "not-allowed",
                            opacity: canApply ? 1 : 0.4,
                          }}
                        >
                          확정
                        </button>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </footer>
        </div>
      </main>
    );
  }

  // ---------- Render: locked-result (최종 순위, 1~4위+배정 분, 발표 시작, 애니메이션) ----------
  if (stage === "locked-result" && snapshot) {
    const allocMinutes = snapshot.allocations.map((ms) =>
      ms >= 60000 ? Math.round(ms / 60000) : 0
    );
    return (
      <main
        className="vote-stage-screen"
        style={{ fontFamily: "var(--font-pretendard), 'Pretendard', system-ui, sans-serif" }}
      >
        <div
          className={`locked-result-content${lockedResultAnimReady ? " locked-result-anim-in" : ""}`}
          style={{
            position: "relative",
            height: "100vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            padding: "clamp(24px, 4vw, 48px)",
          }}
        >
          <header
            className="locked-result-head"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 24,
              flexShrink: 0,
            }}
          >
            <div className="locked-result-title" style={{ flex: "1 1 auto", maxWidth: "60%" }}>
              <h1
                style={{
                  fontFamily: "'Pretendard', var(--font-pretendard), system-ui, sans-serif",
                  fontSize: "clamp(28px, 4.5vw, 42px)",
                  lineHeight: 1.25,
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  color: "rgba(18,18,18,0.95)",
                  margin: 0,
                }}
              >
                최종 순위
              </h1>
            </div>
          </header>

          <footer
            className="locked-result-bottom"
            style={{
              flex: "1 1 auto",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minHeight: 0,
            }}
          >
            <div
              className="vote-stage-bottom-band"
              style={{
                width: "100%",
                height: 324,
                minHeight: 324,
                display: "flex",
                flexDirection: "row",
                alignItems: "stretch",
                gap: 0,
              }}
            >
              <div style={{ flex: "0 0 42%", minHeight: 0 }} aria-hidden />
              <div
                style={{
                  flex: "1 1 58%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  background: "rgba(243,239,231,0.82)",
                  padding: "14px clamp(20px, 3vw, 28px) 14px",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gridTemplateRows: "auto auto",
                    gap: "clamp(12px, 2vw, 20px) clamp(24px, 4vw, 40px)",
                    alignContent: "start",
                  }}
                >
                  {snapshot.rankedChoices.map((choice, i) => (
                    <div
                      key={`${i}-${choice}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        borderBottom: "1px solid rgba(18,18,18,0.12)",
                        paddingBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: "rgba(18,18,18,0.7)",
                          marginBottom: 2,
                        }}
                      >
                        {i + 1}위 · {CHOICE_LABELS[choice]}
                      </span>
                      <span
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          fontSize: 28,
                          fontWeight: 700,
                          lineHeight: 1,
                          color: "rgba(18,18,18,0.95)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {allocMinutes[i]}분
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setStage("present-existing-works");
                      setCurrentWorkIndex(0);
                      setSceneIndex(0);
                      setTimerStatus("idle");
                      setTargetTime(null);
                      setPausedRemainingMs(null);
                      setDisplayRemainingMs(null);
                      persistSnapshot({
                        currentStage: "present-existing-works",
                        currentWorkIndex: 0,
                        sceneIndex: 0,
                        timerStatus: "idle",
                        targetTime: null,
                        pausedRemainingMs: null,
                      });
                    }}
                    className="vote-stage-btn-main"
                  >
                    발표 시작
                  </button>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </main>
    );
  }

  // ---------- Render: present-existing-works (상단 레일 52px, renderSceneByTemplate, ←/→/N 키) ----------
  if (stage === "present-existing-works" && snapshot) {
    const debugMode = searchParams.get("debug") === "1";
    const choice = snapshot.rankedChoices[currentWorkIndex];
    const allocMs = snapshot.allocations[currentWorkIndex];
    const remaining =
      timerStatus === "running" && displayRemainingMs != null
        ? displayRemainingMs
        : timerStatus === "paused" && pausedRemainingMs != null
          ? pausedRemainingMs
          : timerStatus === "ended"
            ? 0
            : allocMs;
    const sec = Math.ceil(remaining / 1000);
    const mm = Math.floor(sec / 60);
    const ss = sec % 60;
    const allocSec = Math.floor(allocMs / 1000);
    const allocMm = Math.floor(allocSec / 60);
    const allocSs = allocSec % 60;
    const railBtnStyle: React.CSSProperties = {
      padding: "0.35rem 0.65rem",
      fontSize: "0.8rem",
      cursor: "pointer",
      background: "rgba(255,255,255,0.1)",
      color: "#fff",
      border: "1px solid rgba(255,255,255,0.22)",
      borderRadius: 0,
    };
    const mainTimerLabel =
      timerStatus === "running" ? "PAUSE" : timerStatus === "paused" ? "RESUME" : "START";
    const mainTimerAction =
      timerStatus === "running" ? pauseTimer : timerStatus === "paused" ? resumeTimer : startTimer;
    const mainTimerDisabled =
      (timerStatus === "running" && mainTimerLabel === "PAUSE") ||
      (timerStatus === "paused" && mainTimerLabel === "RESUME")
        ? false
        : timerStatus === "running";

    return (
      <main style={{ ...baseStyle, height: "100%", overflow: "hidden" }}>
        {/* 상단 고정 바: 관객이 읽기 쉬운 크기, 최소 버튼 */}
        <header
          style={{
            flex: "0 0 auto",
            height: PRESENT_TOP_RAIL_HEIGHT,
            minHeight: PRESENT_TOP_RAIL_HEIGHT,
            background: "rgba(18,18,18,0.94)",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 clamp(1.25rem, 3vw, 2rem)",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.6em", flexWrap: "wrap" }}>
            <span style={{ fontSize: "clamp(22px, 2.2vw, 28px)", fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>
              {currentWorkIndex + 1}위
            </span>
            <span style={{ fontSize: "clamp(22px, 2.2vw, 28px)", fontWeight: 600, opacity: 0.85 }}>/</span>
            <span style={{ fontSize: "clamp(22px, 2.2vw, 28px)", fontWeight: 600, color: "rgba(255,255,255,0.92)" }}>
              {CHOICE_LABELS[choice]}
            </span>
            <span style={{ fontSize: "clamp(22px, 2.2vw, 28px)", fontWeight: 600, opacity: 0.85 }}>/</span>
            <span style={{ fontSize: "clamp(22px, 2.2vw, 28px)", fontWeight: 700, color: "#fff" }}>
              〈{CHOICE_WORK_TITLES[choice]}〉
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "clamp(18px, 1.8vw, 24px)", fontWeight: 600, opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>
              {String(allocMm).padStart(2, "0")}:{String(allocSs).padStart(2, "0")} 배정
            </span>
            <span style={{ fontSize: "clamp(20px, 2vw, 26px)", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#fff" }}>
              {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")} 남음
            </span>
            <button
              type="button"
              onClick={mainTimerAction}
              disabled={mainTimerLabel === "START" && mainTimerDisabled}
              style={railBtnStyle}
            >
              {mainTimerLabel}
            </button>
            <button type="button" onClick={goNextWork} style={railBtnStyle}>
              NEXT
            </button>
            {debugMode && (
              <>
                <button type="button" onClick={restartCurrent} style={railBtnStyle}>
                  RESTART
                </button>
                <button type="button" onClick={endCurrent} style={railBtnStyle}>
                  END CURRENT
                </button>
              </>
            )}
          </div>
        </header>

        {/* scene 콘텐츠 영역: viewport 고정 높이, 스크롤 없음, fit-to-viewport */}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            paddingLeft: "clamp(1.5rem, 4vw, 3rem)",
            paddingRight: "clamp(1.5rem, 4vw, 3rem)",
            paddingBottom: "1rem",
            paddingTop: "1rem",
          }}
        >
          {debugMode && sceneCount > 0 && (
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.8rem", opacity: 0.6 }}>
              <button type="button" aria-label="이전 장면" onClick={goPrevScene} style={railBtnStyle}>
                ‹
              </button>
              <span style={{ minWidth: "3em", textAlign: "center" }}>
                {safeSceneIndex + 1} / {sceneCount}
              </span>
              <button type="button" aria-label="다음 장면" onClick={onNextSceneOrReveal} style={railBtnStyle}>
                ›
              </button>
              <span style={{ marginLeft: "0.5rem" }}>← / → 장면 · N 다음 작업</span>
            </div>
          )}
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {currentScene ? renderSceneByTemplate(currentScene, sceneRevealIndex) : <p style={{ ...PRESENT_BODY_STYLE, opacity: 0.7 }}>장면 없음</p>}
          </div>
        </div>
      </main>
    );
  }

  // ---------- Render: residency-plan (상단 헤더 "2026년 계획", 장면 5개) ----------
  if (stage === "residency-plan") {
    const safeResidencyIndex = Math.min(Math.max(0, residencySceneIndex), RESIDENCY_PLAN_SCENES.length - 1);
    const currentResidencyScene = RESIDENCY_PLAN_SCENES[safeResidencyIndex] ?? null;
    const goResidencyPrev = () => setResidencySceneIndex((i) => Math.max(0, i - 1));
    const goResidencyNext = () => {
      if (safeResidencyIndex >= RESIDENCY_PLAN_SCENES.length - 1) {
        setStage("end");
        if (snapshot) persistSnapshot({ currentStage: "end" });
      } else {
        setResidencySceneIndex((i) => i + 1);
      }
    };
    return (
      <main style={{ ...baseStyle, height: "100%", overflow: "hidden" }}>
        <header
          style={{
            flex: "0 0 auto",
            height: PRESENT_TOP_RAIL_HEIGHT,
            minHeight: PRESENT_TOP_RAIL_HEIGHT,
            background: "rgba(18,18,18,0.94)",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 clamp(1.25rem, 3vw, 2rem)",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.6em", flexWrap: "wrap" }}>
            <span style={{ fontSize: "clamp(22px, 2.2vw, 28px)", fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>
              2026년 계획
            </span>
          </div>
        </header>
        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            paddingLeft: "clamp(1.5rem, 4vw, 3rem)",
            paddingRight: "clamp(1.5rem, 4vw, 3rem)",
            paddingBottom: "1rem",
            paddingTop: "1rem",
          }}
        >
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {currentResidencyScene ? renderSceneByTemplate(currentResidencyScene, 0) : <p style={{ ...PRESENT_BODY_STYLE, opacity: 0.7 }}>장면 없음</p>}
          </div>
        </div>
      </main>
    );
  }

  // ---------- Render: end ----------
  if (stage === "end") {
    return (
      <main style={{ ...baseStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
          발표 종료
        </h1>
        <p style={{ marginBottom: "1rem" }}>Q&A로 전환하세요.</p>
        <button
          type="button"
          onClick={() => {
            clearPresentationSnapshot();
            setStage("setup");
            setSnapshot(null);
            setCurrentWorkIndex(0);
            setSceneIndex(0);
            setTimerStatus("idle");
            setTargetTime(null);
            setPausedRemainingMs(null);
            setDisplayRemainingMs(null);
          }}
          style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          새 발표 시작
        </button>
      </main>
    );
  }

  // ---------- Render: fallback (잘못된 stage) ----------
  return (
    <main style={baseStyle}>
      <p>잘못된 상태입니다. 세션: {sid}</p>
      <button
        type="button"
        onClick={() => setStage("setup")}
        style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
      >
        처음으로
      </button>
    </main>
  );
}

// ---------- Default export: presentation-viewport 래퍼 + body.presentation-active ----------
export default function PresentationPage() {
  return (
    <div
      className="presentation-viewport"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        touchAction: "none",
        background: "#111",
      }}
      onWheel={(e) => e.preventDefault()}
    >
      <Suspense
        fallback={
          <div style={{ ...baseStyle, justifyContent: "center", alignItems: "center" }}>
            <p>로딩 중…</p>
          </div>
        }
      >
        <PresentationContent />
      </Suspense>
    </div>
  );
}
