/**
 * 발표 작업별 scene(장면) 데이터.
 * 템플릿 기반 렌더링. 나중에 문장/이미지 경로만 바꿔 끼울 수 있도록 구조만 고정.
 */

import type { VoteChoice } from "@/lib/validation";

export type SceneTemplateType =
  | "title_anchor"
  | "process_flow"
  | "compare_split"
  | "commentary_method"
  | "left_right_images"
  | "six_columns_image"
  | "two_columns_titled"
  | "left_image_right_video"
  | "left_images_right_video"
  | "images_top_highlight_bottom"
  | "two_columns_image_caption"
  | "base_image_overlay_steps"
  | "two_columns_eight_images"
  | "top_bottom_images"
  | "two_columns_caption_top"
  | "left_video_right_image";

export interface PresentationScene {
  id: string;
  template: SceneTemplateType;
  title?: string;
  subtitle?: string;
  body?: string;
  paragraphs?: string[];
  label?: string;
  images?: string[];
  /** 영상 경로 (있으면 이미지 대신 재생). six_columns_image 등에서 하단 미디어로 사용. */
  video?: string;
  caption?: string;
  captions?: string[];
  /** 각 캡션 아래 부가 정보 (예: 연도, 장소). captions와 1:1 대응. */
  captionSubs?: string[];
  notes?: string;
  meta?: string;
  revealSteps?: string[];
  /** 우측 화살표로 하나씩 교체되는 중앙 큰 글씨 (한 번에 하나만 표시). 예: ["물건", "분단을 둘러싼 퍼포먼스"] */
  centerReplaceSteps?: string[];
  /** 3칼럼 레이아웃 + 우측 화살표 시 각 칼럼 아래에 revealText 동시 등장 */
  threeColumnReveal?: {
    mainTitle: string;
    columns: { title: string; body: string; revealText?: string }[];
  };
  /** 상단 6칼럼(카테고리별 변수 정리) + 하단 이미지 1장 */
  sixColumnVariables?: {
    columns: {
      title: string;
      variables: { id: string; title: string; description: string; cycle: string }[];
    }[];
  };
  /** 좌/우 두 칼럼, 각 칼럼 상단 제목 + 아래 이미지 3개 */
  twoColumns?: {
    leftTitle: string;
    leftImages: string[];
    rightTitle: string;
    rightImages: string[];
  };
  /** 좌/우 두 칼럼, 각 칼럼에 이미지 1장 + 아래 설명글 */
  twoColumnsImageCaption?: {
    leftImage: string;
    leftCaption: string;
    rightImage: string;
    rightCaption: string;
  };
  /** 베이스 이미지 위에 오른쪽 화살표로 오버레이 순차 표시/숨김 (보임→숨김 반복) */
  baseImageOverlay?: {
    baseImage: string;
    overlaySteps: { images: string[]; captions?: string[] }[];
  };
  /** 좌/우 각각 설명(가운데 정렬) + 이미지 4장 세로 1열(4행) */
  twoColumnsEightImages?: {
    leftCaption: string;
    rightCaption: string;
    leftImages: string[];
    rightImages: string[];
  };
  /** 상단 이미지 1장 + 하단 이미지 1장 (위/아래 배치) */
  topBottomImages?: { topImage: string; bottomImage: string };
  /** 좌/우 각각 상단 가운데 설명 + 아래 이미지 1장 */
  twoColumnsCaptionTop?: {
    leftCaption: string;
    leftImage: string;
    rightCaption: string;
    rightImage: string;
  };
  /** 좌측 영상 + 우측 이미지 1장 */
  leftVideoRightImage?: { video: string; rightImage: string };
  /** 화면 좌우 분할, 각 쪽에 큰 글씨 텍스트 (가운데 정렬). 예: { left: "DMZ", right: "뉴몰든" } */
  splitText?: { left: string; right: string };
  /** 상단 이미지 + 하단 가로 흐름 구조도 (변수→지표→해석→입력→출력 + 피드백) */
  flowDiagram?: {
    topImage?: string;
    /** 있으면 steps 대신 이 이미지(SVG/PNG)로 구조도 표시. 수정은 해당 파일에서. */
    diagramImage?: string;
    steps: { mainLabel: string; title: string; details: string }[];
  };
}

export type WorkScenesMap = Record<VoteChoice, PresentationScene[]>;

const ITEM_ASSETS = "/presentation-assets/item";

const ITEM_SCENES: PresentationScene[] = [
  {
    id: "item-01",
    template: "process_flow",
    video: `${ITEM_ASSETS}/scene-01.mp4`,
    revealSteps: ["세관사무소", "국가정보원", "세관"],
  },
  {
    id: "item-02",
    template: "compare_split",
    paragraphs: ["통관 보류 물건", "실제 도착한 물건들"],
    images: [
      `${ITEM_ASSETS}/scene-03-01.jpg`,
      `${ITEM_ASSETS}/scene-03-02.jpg`,
      `${ITEM_ASSETS}/scene-03-03.jpg`,
      `${ITEM_ASSETS}/scene-03-04.jpg`,
      `${ITEM_ASSETS}/scene-03-05.jpg`,
      `${ITEM_ASSETS}/scene-03-06.jpg`,
      `${ITEM_ASSETS}/scene-03-01.jpg`,
      `${ITEM_ASSETS}/scene-03-02.jpg`,
      `${ITEM_ASSETS}/scene-03-03.jpg`,
      `${ITEM_ASSETS}/scene-03-04.jpg`,
    ],
  },
  {
    id: "item-03",
    template: "commentary_method",
    images: [
      `${ITEM_ASSETS}/scene-04-01.jpg`,
      `${ITEM_ASSETS}/scene-04-02.jpg`,
      `${ITEM_ASSETS}/scene-04-03.jpg`,
    ],
  },
  {
    id: "item-04",
    template: "title_anchor",
    centerReplaceSteps: ["물건", "분단을 둘러싼 퍼포먼스"],
  },
  {
    id: "item-05",
    template: "title_anchor",
    threeColumnReveal: {
      mainTitle: "노스럽 프라이(Northrop Frye)가 정의한 희극적 인물 유형",
      columns: [
        { title: "허풍선이", body: "자신을 실제보다 크고 대단하게 내세우는 \n 허풍쟁이·사기꾼형 인물", revealText: "세관사무소" },
        { title: "촌뜨기", body: "세련됨이나 사회적 감각이 부족한,\n 둔하고 고지식한 촌뜨기형 인물", revealText: "국가정보원" },
        { title: "익살꾼", body: "진지한 질서를 깨며 농담과 장난으로\n 분위기를 흔드는 익살꾼·광대형 인물", revealText: "세관" },
      ],
    },
  },
  {
    id: "item-06",
    template: "commentary_method",
    images: [
      `${ITEM_ASSETS}/scene-07-01.jpg`,
      `${ITEM_ASSETS}/scene-07-02.jpg`,
      `${ITEM_ASSETS}/scene-07-03.jpg`,
    ],
  },
  {
    id: "item-07",
    template: "left_right_images",
    images: [
      `${ITEM_ASSETS}/scene-08-left-01.jpg`,
      `${ITEM_ASSETS}/scene-08-left-02.jpg`,
      `${ITEM_ASSETS}/scene-08-right.jpg`,
    ],
  },
  {
    id: "item-08",
    template: "commentary_method",
    images: [
      `${ITEM_ASSETS}/scene-09-01.jpg`,
      `${ITEM_ASSETS}/scene-09-02.jpg`,
      `${ITEM_ASSETS}/scene-04-02.jpg`,
    ],
  },
  {
    id: "item-09",
    template: "title_anchor",
    centerReplaceSteps: ["이념", "유통"],
  },
];

const IMAGE_ASSETS = "/presentation-assets/image";

/** 이미지 작업 장면 (1~8). 장면8: 좌우 이미지+설명(two_columns_image_caption). */
const IMAGE_SCENES: PresentationScene[] = [
  {
    id: "image-01",
    template: "commentary_method",
    images: [
      `${IMAGE_ASSETS}/scene-01-01.jpg`,
      `${IMAGE_ASSETS}/scene-01-02.jpg`,
      `${IMAGE_ASSETS}/scene-01-03.jpg`,
    ],
    captions: ["PLAY HOME, SWEET HOME", "MAKE HOME, SWEET HOME", "IMAGINE HOME, SWEET HOME"],
    captionSubs: ["2023, 탈영역우정국", "2024, 두산아트센터 Space111", "2024, 삿포로문화예술교류센터 SCARTS"],
  },
  {
    id: "image-02",
    template: "base_image_overlay_steps",
    baseImageOverlay: {
      baseImage: `${IMAGE_ASSETS}/scene-02-main.png`,
      overlaySteps: [
        { images: [`${IMAGE_ASSETS}/scene-02-01.jpg`] },
        { images: [`${IMAGE_ASSETS}/scene-02-02-01.png`, `${IMAGE_ASSETS}/scene-02-02-02.png`], captions: ["한국어로 검색한 '북한 집'이미지를 학습시킨\n인공지능 모델이 생성한 이미지", "영어로 검색한 'North Korea House' 이미지를 학습시킨\n인공지능 모델이 생성한 이미지"] },
        { images: [`${IMAGE_ASSETS}/scene-02-03.jpg`] },
        { images: [`${IMAGE_ASSETS}/scene-02-04.jpg`] },
        { images: [`${IMAGE_ASSETS}/scene-02-05-01.jpg`, `${IMAGE_ASSETS}/scene-02-05-02.jpg`, `${IMAGE_ASSETS}/scene-02-05-03.jpg`] },
        { images: [`${IMAGE_ASSETS}/scene-02-06.jpg`] },
        { images: [`${IMAGE_ASSETS}/scene-02-07.jpg`] },
      ],
    },
  },
  {
    id: "image-03",
    template: "title_anchor",
    centerReplaceSteps: ["북한에 대한 부정확한 이미지", "남한의 지정학적 한계를 보여주는 \n 정확한 이미지"],
  },
  {
    id: "image-04",
    template: "two_columns_eight_images",
    twoColumnsEightImages: {
      leftCaption: "한국어로 검색한 '북한 집'이미지를 학습시킨\n인공지능 모델이 생성한 이미지",
      rightCaption: "영어로 검색한 'North Korea House' 이미지를 학습시킨\n인공지능 모델이 생성한 이미지",
      leftImages: [
        `${IMAGE_ASSETS}/scene-04-left-01.png`,
        `${IMAGE_ASSETS}/scene-04-left-02.png`,
        `${IMAGE_ASSETS}/scene-04-left-03.png`,
        `${IMAGE_ASSETS}/scene-04-left-04.png`,
      ],
      rightImages: [
        `${IMAGE_ASSETS}/scene-04-right-01.png`,
        `${IMAGE_ASSETS}/scene-04-right-02.png`,
        `${IMAGE_ASSETS}/scene-04-right-03.png`,
        `${IMAGE_ASSETS}/scene-04-right-04.png`,
      ],
    },
  },
  {
    id: "image-05",
    template: "title_anchor",
    centerReplaceSteps: ["기술 비판", "사회정치적 한계"],
  },

];

const DATA_ASSETS = "/presentation-assets/data";

const DATA_SCENES: PresentationScene[] = [
  {
    id: "data-01",
    template: "left_right_images",
    images: [
      `${DATA_ASSETS}/scene-01-left-01.webp`,
      `${DATA_ASSETS}/scene-01-left-02.png`,
      `${DATA_ASSETS}/scene-01-right.png`,
    ],
  },
  {
    id: "data-02",
    template: "six_columns_image",
    video: `${DATA_ASSETS}/scene-02-main.mp4`,
    sixColumnVariables: {
      columns: [
        {
          title: "제도",
          variables: [
            { id: "L1", title: "정전협정 시간 감쇠 지수", description: "지수 계산은 1953년 7월 27일 정전협정 이후 경과 시간에 기반합니다.", cycle: "연간" },
            { id: "L2", title: "접경지역 내 자연환경보전지역 비율", description: "접경지역 내 자연환경보전지역의 면적 비율을 나타내며, vworld.kr 자연환경보전지역 공공데이터를 기반으로 합니다.", cycle: "연간" },
            { id: "P2", title: "남북교류·접촉 지수", description: "통일부의 남북 협력사업 승인 현황 API를 기반으로 한 연간 총 건수입니다.", cycle: "연간" },
          ],
        },
        {
          title: "군사",
          variables: [
            { id: "M1", title: "DMZ 사건 누적 지수", description: "DMZ 관련 사건들을 기반으로 한 누적 지수입니다.", cycle: "연간" },
            { id: "M2", title: "군사 긴장 변동성", description: "뉴스 기사 수를 기반으로 한 일일 데이터이며, 주간 변동성으로 변환됩니다.", cycle: "10분" },
            { id: "M3", title: "군사분계선 월경 횟수", description: "신문 기사를 기반으로 한 월별 월경 횟수를 나타내며, 최근 6개월 데이터가 반영됩니다.", cycle: "월별" },
          ],
        },
        {
          title: "부동산",
          variables: [
            { id: "S1", title: "강남-접경지 가격 상관계수", description: "국토부 및 부동산 API를 기반으로 한 월별 상관계수입니다.", cycle: "월별" },
            { id: "R2", title: "DMZ 내부 토지 거래량 지수", description: "연도별 거래량 지수로, '현재 연도 / 과거 5년 평균 * 100'으로 계산됩니다.", cycle: "월별" },
            { id: "R3", title: "DMZ 내부 토지 공시지가 상승률", description: "연도별 지수로, '현재 연도 평균 / 작년 평균 * 100'으로 계산됩니다.", cycle: "연간" },
          ],
        },
        {
          title: "언론",
          variables: [
            { id: "D1", title: "DMZ/분단 미디어 노출 지수", description: "뉴스 및 검색량 데이터를 기반으로 일별 지수가 계산됩니다.", cycle: "일별" },
            { id: "D2", title: "긴장 뉴스 감성 지수", description: "뉴스 내용 분석을 기반으로 한 일일 데이터이며, 주간 평균으로 변환됩니다.", cycle: "일별" },
            { id: "D3", title: "통일 긍정 여론 지수", description: "여론조사 결과를 기반으로 한 연간 지수입니다.", cycle: "연간" },
          ],
        },
        {
          title: "사회",
          variables: [
            { id: "P1", title: "20-30대 보수 성향 비율", description: "KOSIS API의 이념적 성향 통계를 기반으로 한 연간 비율이며, 19~29세 및 30~39세 보수 성향의 평균을 나타냅니다.", cycle: "연간" },
            { id: "P3", title: "국가재난문자 발송 횟수", description: "재난안전데이터공유플랫폼 API를 기반으로 한 월별 발송 횟수입니다.", cycle: "월별" },
            { id: "P4", title: "동국대학교 북한학과 입시 경쟁률", description: "정시 모집의 경쟁률입니다.", cycle: "연간" },
          ],
        },
        {
          title: "미디어",
          variables: [
            { id: "P5", title: "'이제 만나러 갑니다' 프로그램 시청률", description: "닐슨 시청률 순위를 기반으로 합니다.", cycle: "주별" },
            { id: "P6", title: "조선중앙TV 군사 콘텐츠 비율", description: "조선중앙TV 편성표를 기반으로 군사 콘텐츠 비율이 계산됩니다.", cycle: "일별" },
          ],
        },
      ],
    },
  },
  {
    id: "data-03",
    template: "title_anchor",
    video: `${DATA_ASSETS}/scene-03-main.mp4`,
  },
  {
    id: "data-04",
    template: "left_image_right_video",
    images: [`${DATA_ASSETS}/scene-04-left.png`],
    video: `${DATA_ASSETS}/scene-04-video.mp4`,
  },
  {
    id: "data-05",
    template: "title_anchor",
    video: `${DATA_ASSETS}/scene-05-main.mp4`,
  },
  {
    id: "data-06",
    template: "two_columns_titled",
    twoColumns: {
      leftTitle: "분단, 역사, 비극",
      leftImages: [
        `${DATA_ASSETS}/scene-04-left-01.jpg`,
        `${DATA_ASSETS}/scene-04-left-02.avif`,
        `${DATA_ASSETS}/scene-04-left-03.jpg`,
      ],
      rightTitle: "토지, 개발, 매물",
      rightImages: [
        `${DATA_ASSETS}/scene-04-right-01.png`,
        `${DATA_ASSETS}/scene-04-right-02.jpg`,
        `${DATA_ASSETS}/scene-04-right-03.png`,
      ],
    },
  },
  {
    id: "data-07",
    template: "two_columns_titled",
    twoColumns: {
      leftTitle: "",
      leftImages: [`${DATA_ASSETS}/scene-05-left.jpg`],
      rightTitle: "",
      rightImages: [`${DATA_ASSETS}/scene-05-right.jpg`],
    },
  },
];

const NEAR_ASSETS = "/presentation-assets/near";

const NEAR_SCENES: PresentationScene[] = [
  {
    id: "near-01",
    template: "left_image_right_video",
    images: [`${NEAR_ASSETS}/scene-01-left.jpg`],
    video: `${NEAR_ASSETS}/scene-01-right.mp4`,
  },
  {
    id: "near-02",
    template: "title_anchor",
    video: `${NEAR_ASSETS}/scene-03-main.mp4`,
  },
  {
    id: "near-03",
    template: "title_anchor",
    video: `${NEAR_ASSETS}/scene-02-main.mp4`,
  },
  {
    id: "near-04",
    template: "title_anchor",
    video: `${NEAR_ASSETS}/scene-04-main.mp4`,
  },
  {
    id: "near-05",
    template: "title_anchor",
    images: [`${NEAR_ASSETS}/scene-05-main.png`],
  },
];

const SCENES_MAP: WorkScenesMap = {
  ITEM: ITEM_SCENES,
  IMAGE: IMAGE_SCENES,
  DATA: DATA_SCENES,
  NEAR: NEAR_SCENES,
};

export function getScenesForChoice(choice: VoteChoice): PresentationScene[] {
  return SCENES_MAP[choice] ?? [];
}

const RESIDENCY_ASSETS = "/presentation-assets/residency";

/** 레지던시 계획 단계용 장면 7개. 내용 수정은 여기서. */
export const RESIDENCY_PLAN_SCENES: PresentationScene[] = [
  { id: "residency-01", template: "title_anchor", splitText: { left: "중국-훈춘", right: "영국-뉴몰든" } },
  {
    id: "residency-02",
    template: "title_anchor",
    video: `${RESIDENCY_ASSETS}/scene-02.mp4`,
  },
  {
    id: "residency-03",
    template: "left_video_right_image",
    leftVideoRightImage: {
      video: `${RESIDENCY_ASSETS}/scene-03-video.mp4`,
      rightImage: `${RESIDENCY_ASSETS}/scene-03.jpg`,
    },
  },
  {
    id: "residency-04",
    template: "title_anchor",
    label: "남한의 분단체제를 살아온 사람에게",
    centerReplaceSteps: ["남한의 바깥을 체험할 수 있는가?"],
  },
  {
    id: "residency-05",
    template: "left_images_right_video",
    images: [`${RESIDENCY_ASSETS}/scene-04-left-1.jpg`, `${RESIDENCY_ASSETS}/scene-04-left-2.jpg`],
    video: `${RESIDENCY_ASSETS}/scene-04-video.mp4`,
  },
  {
    id: "residency-06",
    template: "images_top_highlight_bottom",
    images: [`${RESIDENCY_ASSETS}/scene-05-1.jpg`, `${RESIDENCY_ASSETS}/scene-05-2.jpg`, `${RESIDENCY_ASSETS}/scene-05-3.jpg`],
    subtitle: "사적공간 → 공적공간",
  },
  {
    id: "residency-07",
    template: "two_columns_caption_top",
    twoColumnsCaptionTop: {
      leftCaption: "인공지능이 만든 '영국의 탈북민 집 거실'",
      leftImage: `${RESIDENCY_ASSETS}/scene-07-left.png`,
      rightCaption: "실제 뉴몰든 거주 탈북민의 집",
      rightImage: `${RESIDENCY_ASSETS}/scene-07-right.png`,
    },
  },
];
