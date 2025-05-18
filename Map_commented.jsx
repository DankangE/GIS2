// Map.jsx 파일 - OpenLayers를 사용한 GIS 지도 컴포넌트

// React 관련 라이브러리 및 훅 임포트
import React, {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle, // 부모 컴포넌트에서 자식 ref에 접근할 수 있는 기능 제공
  forwardRef, // ref를 전달하기 위한 고차 컴포넌트
  useState,
} from "react";

// OpenLayers 핵심 구성요소 임포트
import { Map as OlMap, View } from "ol"; // 지도 및 뷰 클래스
import { defaults as defaultControls } from "ol/control"; // 기본 컨트롤(확대/축소 등)
import { fromLonLat, toLonLat, get as getProjection } from "ol/proj"; // 좌표계 변환 함수
import { Tile as TileLayer } from "ol/layer"; // 타일 레이어 클래스
import { XYZ } from "ol/source"; // XYZ 타일 소스 클래스(지도 타일)

// 맵 객체 관련 컴포넌트 임포트
import {
  createGcpPointsLayer, // GCP(지상기준점) 레이어 생성 함수
  createPointFeature, // 포인트 피처 생성 함수
} from "./mapObjects/GCPObjects.jsx";
import { createLandingPointsLayer } from "./mapObjects/LandingObjects.jsx"; // 이착륙 레이어 생성 함수
import MissionObjects from "./mapObjects/MissionObjects.jsx"; // 미션 객체 관련 컴포넌트

// 버튼 컴포넌트 임포트
import AddButton from "../../components/buttons/AddButton.jsx"; // 포인트 추가 버튼
import DeleteButton from "../../components/buttons/DeleteButton.jsx"; // 포인트 삭제 버튼
import MoveButton from "../../components/buttons/MoveButton.jsx"; // 포인트 이동 버튼

// OpenLayers 인터랙션 클래스 임포트 - 사용자 상호작용 기능
import { Select, Translate } from "ol/interaction"; // 선택 및 이동 인터랙션
import {
  click, // 클릭 조건
  shiftKeyOnly, // Shift 키 조건
  platformModifierKeyOnly, // Ctrl/Cmd 키 조건
} from "ol/events/condition";

// OpenLayers CSS 기본 스타일
import "ol/ol.css";

// 스타일 관련 클래스 임포트 - 맵 객체 시각화
import { Style, Circle, Fill, Stroke, Text, Icon } from "ol/style";

// 벡터 레이어 관련 임포트
import VectorLayer from "ol/layer/Vector"; // 벡터 레이어 클래스
import VectorSource from "ol/source/Vector"; // 벡터 소스 클래스

// 그리기 및 스냅 인터랙션 임포트
import Draw from "ol/interaction/Draw"; // 그리기 인터랙션
import Snap from "ol/interaction/Snap"; // 스냅 인터랙션

// 미션 버튼 및 다이얼로그 관련 컴포넌트 임포트
import MissionButton from "../../components/buttons/MissionButton.jsx";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";

// 맵 객체 관련 클래스 임포트
import Feature from "ol/Feature"; // 피처 클래스
import Point from "ol/geom/Point"; // 포인트 지오메트리 클래스
import Modify from "ol/interaction/Modify"; // 수정 인터랙션
import GeoJSON from "ol/format/GeoJSON"; // GeoJSON 포맷 클래스
import { getCenter as getExtentCenter } from "ol/extent"; // 범위 중심점 구하기

// 객체 변환 인터랙션(회전, 이동, 크기 조정) 임포트
import TransformInteraction from "ol-ext/interaction/Transform";
import "ol-ext/dist/ol-ext.css";

// ===== 상수 정의 =====
// 지도 초기 설정 상수
const MAP_CONFIG = {
  INITIAL_CENTER: [126.978, 37.5665], // 서울시청 좌표(경도, 위도)
  INITIAL_ZOOM: 15, // 초기 확대/축소 레벨
  MIN_ZOOM: 7, // 최소 확대/축소 레벨
  MAX_ZOOM: 20, // 최대 확대/축소 레벨
  PROJECTION: "EPSG:3857", // 웹 메르카토르 투영 체계
  TILE_URL: "http://xdworld.vworld.kr:8080/2d/Base/202002/{z}/{x}/{y}.png", // 브이월드 지도 타일 URL
};

// 포인트 스타일 정의
const POINT_STYLE = {
  // 선택된 포인트 스타일
  SELECTED: new Style({
    image: new Circle({
      radius: 8, // 원 반지름
      fill: new Fill({ color: "blue" }), // 파란색 채우기
      stroke: new Stroke({ color: "yellow", width: 3 }), // 노란색 테두리
    }),
    text: new Text({
      offsetY: -12, // 텍스트 위치 조정(위쪽)
      font: "12px sans-serif", // 폰트 설정
      fill: new Fill({ color: "black" }), // 검은색 텍스트
      stroke: new Stroke({ color: "white", width: 2 }), // 흰색 텍스트 테두리(가독성 향상)
    }),
  }),
  // 기본 포인트 스타일
  DEFAULT: new Style({
    image: new Circle({
      radius: 5, // 원 반지름
      fill: new Fill({ color: "blue" }), // 파란색 채우기
      stroke: new Stroke({ color: "white", width: 1.5 }), // 흰색 테두리
    }),
  }),
};

// ===== 맵 컴포넌트 정의 =====
// forwardRef를 사용해 부모 컴포넌트에서 ref를 통해 접근 가능
const MapTest = forwardRef(
  (
    {
      gcpData, // 지상기준점(GCP) 데이터
      modifiedData, // 수정된 데이터
      handleMapPointAdded, // 맵에 포인트 추가 처리 콜백
      handleFeatureMoved, // 피처 이동 처리 콜백
      handleFeatureDeleted, // 피처 삭제 처리 콜백
      currentTab, // 현재 활성화된 탭(0: GCP, 1: 이착륙, 2: 임무)
      onFeatureSelect, // 피처 선택 처리 콜백
      onMissionFeatureAdded, // 미션 피처 추가 처리 콜백
    },
    ref // 부모 컴포넌트에서 접근할 ref
  ) => {
    // DOM 요소 및 지도 객체 참조
    const mapContent = useRef(null); // 지도가 렌더링될 DOM 요소
    const mapRef = useRef(null); // 지도 객체
    const gcpLayerRef = useRef(null); // GCP 레이어
    const landingLayerRef = useRef(null); // 이착륙 레이어
    const missionLayerRef = useRef(null); // 미션 레이어
    const pointFeaturesRef = useRef([]); // 포인트 피처 배열
    const nextObjectIdRef = useRef(1); // 다음 객체 ID

    // 상태 플래그
    const isAddingPointRef = useRef(false); // 포인트 추가 모드 활성화 여부
    const isDeletingPointRef = useRef(false); // 포인트 삭제 모드 활성화 여부
    const isMovingPointRef = useRef(false); // 포인트 이동 모드 활성화 여부

    // 인터랙션 참조
    const selectInteractionRef = useRef(null); // 선택 인터랙션
    const translateInteractionRef = useRef(null); // 이동 인터랙션
    const gcpGridRef = useRef(null); // GCP 그리드

    // 폴리곤 관련 참조
    const polygonLayerRef = useRef(null); // 폴리곤 레이어
    const polygonSourceRef = useRef(null); // 폴리곤 소스
    const drawInteractionRef = useRef(null); // 그리기 인터랙션
    const snapInteractionRef = useRef(null); // 스냅 인터랙션

    // 꼭짓점 관련 참조
    const vertexLayerRef = useRef(null); // 꼭짓점 레이어
    const vertexSourceRef = useRef(null); // 꼭짓점 소스
    const modifyInteractionRef = useRef(null); // 수정 인터랙션

    // 미션 관련 상태
    const [missionModalOpen, setMissionModalOpen] = React.useState(false); // 미션 모달 열림 상태
    const [drawType, setDrawType] = React.useState("Polygon"); // 그리기 타입(Polygon, LineString, Point, Circle)
    const [selectedFeatureId, setSelectedFeatureId] = React.useState(null); // 선택된 피처 ID
    const [missionData, setMissionData] = useState(null); // 미션 데이터

    // 미션 모달 제어 함수
    const handleMissionButtonClick = () => setMissionModalOpen(true); // 미션 버튼 클릭 시 모달 열기
    const handleMissionModalClose = () => setMissionModalOpen(false); // 모달 닫기
    const handleDrawTypeChange = (e) => setDrawType(e.target.value); // 그리기 타입 변경

    // 현재 탭에 맞는 레이어 반환 함수
    const getCurrentLayer = useCallback(() => {
      switch (currentTab) {
        case 0: // GCP 탭
          return gcpLayerRef.current;
        case 1: // 이착륙 탭
          return landingLayerRef.current;
        case 2: // 임무 탭
          return missionLayerRef.current;
        default:
          return gcpLayerRef.current;
      }
    }, [currentTab]);

    // ===== 모드 토글 핸들러 =====
    // 포인트 추가 모드 토글 - 포인트 추가 버튼 클릭 시 호출됨
    const handleToggleAddingMode = useCallback((isAdding) => {
      isAddingPointRef.current = isAdding; // 추가 모드 상태 설정
      if (isAdding) {
        // 다른 모드들은 비활성화
        if (isDeletingPointRef.current) {
          // 삭제 모드가 활성화되어 있으면 비활성화
          isDeletingPointRef.current = false;
          if (handleToggleDeletingMode.reset) {
            handleToggleDeletingMode.reset(false); // 삭제 버튼 상태 초기화
          }
        }
        if (isMovingPointRef.current) {
          // 이동 모드가 활성화되어 있으면 비활성화
          isMovingPointRef.current = false;
          if (handleToggleMovingMode.reset) {
            handleToggleMovingMode.reset(false); // 이동 버튼 상태 초기화
          }
        }
        // 선택 및 이동 인터랙션 비활성화
        if (selectInteractionRef.current) {
          selectInteractionRef.current.setActive(false); // 선택 인터랙션 비활성화
        }
        if (translateInteractionRef.current) {
          translateInteractionRef.current.setActive(false); // 이동 인터랙션 비활성화
        }
      }
    }, []);

    // 포인트 삭제 모드 토글 - 포인트 삭제 버튼 클릭 시 호출됨
    const handleToggleDeletingMode = useCallback((isDeleting) => {
      isDeletingPointRef.current = isDeleting; // 삭제 모드 상태 설정
      if (isDeleting) {
        // 다른 모드들은 비활성화
        if (isAddingPointRef.current) {
          // 추가 모드가 활성화되어 있으면 비활성화
          isAddingPointRef.current = false;
          if (handleToggleAddingMode.reset) {
            handleToggleAddingMode.reset(false); // 추가 버튼 상태 초기화
          }
        }
        if (isMovingPointRef.current) {
          // 이동 모드가 활성화되어 있으면 비활성화
          isMovingPointRef.current = false;
          if (handleToggleMovingMode.reset) {
            handleToggleMovingMode.reset(false); // 이동 버튼 상태 초기화
          }
        }
        // 선택 및 이동 인터랙션 비활성화
        if (selectInteractionRef.current) {
          selectInteractionRef.current.setActive(false); // 선택 인터랙션 비활성화
        }
        if (translateInteractionRef.current) {
          translateInteractionRef.current.setActive(false); // 이동 인터랙션 비활성화
        }
      }
    }, []);

    // 포인트 이동 모드 토글 - 포인트 이동 버튼 클릭 시 호출됨
    const handleToggleMovingMode = useCallback((isMoving) => {
      isMovingPointRef.current = isMoving; // 이동 모드 상태 설정
      if (isMoving) {
        // 다른 모드들은 비활성화
        if (isAddingPointRef.current) {
          // 추가 모드가 활성화되어 있으면 비활성화
          isAddingPointRef.current = false;
          if (handleToggleAddingMode.reset) {
            handleToggleAddingMode.reset(false); // 추가 버튼 상태 초기화
          }
        }
        if (isDeletingPointRef.current) {
          // 삭제 모드가 활성화되어 있으면 비활성화
          isDeletingPointRef.current = false;
          if (handleToggleDeletingMode.reset) {
            handleToggleDeletingMode.reset(false); // 삭제 버튼 상태 초기화
          }
        }
        // 선택 및 이동 인터랙션 활성화
        if (selectInteractionRef.current) {
          selectInteractionRef.current.setActive(true); // 선택 인터랙션 활성화
        }
        if (translateInteractionRef.current) {
          translateInteractionRef.current.setActive(true); // 이동 인터랙션 활성화
        }
      } else {
        // 이동 모드 종료 시 선택만 활성화, 이동은 비활성화
        if (selectInteractionRef.current) {
          selectInteractionRef.current.setActive(true); // 선택 인터랙션 활성화
          selectInteractionRef.current.getFeatures().clear(); // 선택된 피처 초기화
        }
        if (translateInteractionRef.current) {
          translateInteractionRef.current.setActive(false); // 이동 인터랙션 비활성화
        }
      }
    }, []);

    // ===== 지도 초기화 (컴포넌트 마운트 시 1회만 실행) =====
    useEffect(() => {
      if (!mapContent.current) return; // 맵 컨테이너가 없으면 종료

      // GCP 레이어 생성
      const { vectorLayer: gcpLayer, vectorSource: gcpSource } =
        createGcpPointsLayer(); // GCP 레이어 및 소스 생성
      gcpLayerRef.current = { layer: gcpLayer, source: gcpSource }; // 레이어 참조 저장

      // 이착륙 레이어 생성
      const { vectorLayer: landingLayer, vectorSource: landingSource } =
        createLandingPointsLayer(); // 이착륙 레이어 및 소스 생성
      landingLayerRef.current = { layer: landingLayer, source: landingSource }; // 레이어 참조 저장

      // OpenLayers 맵 객체 생성
      const map = new OlMap({
        controls: defaultControls({ zoom: false, rotate: false }).extend([]), // 기본 컨트롤 설정
        layers: [
          // 배경 타일 레이어 추가 (베이스맵)
          new TileLayer({
            source: new XYZ({
              url: MAP_CONFIG.TILE_URL, // 브이월드 타일 URL
            }),
          }),
          gcpLayer, // GCP 레이어 추가
          landingLayer, // 이착륙 레이어 추가
        ],
        view: new View({
          projection: getProjection(MAP_CONFIG.PROJECTION), // 투영 체계 설정
          center: fromLonLat(MAP_CONFIG.INITIAL_CENTER), // 초기 중심점 설정 (경위도에서 변환)
          zoom: MAP_CONFIG.INITIAL_ZOOM, // 초기 줌 레벨
          minZoom: MAP_CONFIG.MIN_ZOOM, // 최소 줌 레벨
          maxZoom: MAP_CONFIG.MAX_ZOOM, // 최대 줌 레벨
        }),
        target: mapContent.current, // 맵이 렌더링될 DOM 요소
      });

      // 선택 인터랙션 생성 - 포인트 선택 기능
      const select = new Select({
        layers: [gcpLayer], // 선택 가능한 레이어 설정
        condition: click, // 클릭으로 선택
        style: (feature) => {
          // 선택된 피처의 스타일 설정
          const style = POINT_STYLE.SELECTED.clone(); // 기본 선택 스타일 복제
          style.getText().setText(feature.get("properties")?.name || ""); // 포인트 이름 표시
          return style;
        },
      });

      // 이동 인터랙션 생성 - 선택된 포인트 이동 기능
      const translate = new Translate({
        features: select.getFeatures(), // 선택된 피처를 이동 대상으로 설정
      });

      // 피처 이동 완료 이벤트 처리
      translate.on("translateend", function (event) {
        const features = event.features.getArray(); // 이동된 피처 배열
        features.forEach((feature) => {
          // 이동된 위치의 좌표 가져오기
          const geometry = feature.getGeometry();
          const coords = geometry.getCoordinates(); // 웹 메르카토르 좌표
          const [lon, lat] = toLonLat(coords); // 경위도로 변환

          // 피처 속성 업데이트
          const props = feature.get("properties");
          if (props) {
            props.lon = parseFloat(lon); // 경도 업데이트
            props.lat = parseFloat(lat); // 위도 업데이트
            feature.set("properties", { ...props }); // 속성 설정
            feature.changed(); // 변경 알림

            // 상위 컴포넌트에 피처 이동 알림
            if (typeof handleFeatureMoved === "function") {
              handleFeatureMoved({
                objectId: props.objectId,
                lat: props.lat,
                lon: props.lon,
              });
            }
          }
        });
      });

      // 인터랙션 활성화 설정
      select.setActive(true); // 선택 인터랙션 활성화
      translate.setActive(false); // 이동 인터랙션 초기에는 비활성화

      // 지도에 인터랙션 추가
      map.addInteraction(select); // 선택 인터랙션 추가
      map.addInteraction(translate); // 이동 인터랙션 추가

      // 인터랙션 참조 저장
      selectInteractionRef.current = select;
      translateInteractionRef.current = translate;

      // 폴리곤 레이어 및 인터랙션 초기화 (임무 탭용)
      const polygonSource = new VectorSource(); // 폴리곤 소스 생성
      const polygonLayer = new VectorLayer({ source: polygonSource }); // 폴리곤 레이어 생성
      polygonLayer.setZIndex(100); // 다른 레이어 위에 표시되도록 z-index 설정
      polygonLayerRef.current = polygonLayer; // 레이어 참조 저장
      polygonSourceRef.current = polygonSource; // 소스 참조 저장

      // 그리기 및 스냅 인터랙션 생성 (초기화만, 나중에 필요할 때 지도에 추가)
      const draw = new Draw({ source: polygonSource, type: "Polygon" }); // 폴리곤 그리기
      const snap = new Snap({ source: polygonSource }); // 스냅 인터랙션
      drawInteractionRef.current = draw; // 그리기 인터랙션 참조 저장
      snapInteractionRef.current = snap; // 스냅 인터랙션 참조 저장

      // 꼭짓점 마커용 레이어 추가
      const vertexSource = new VectorSource(); // 꼭짓점 소스 생성
      const vertexLayer = new VectorLayer({
        source: vertexSource,
        style: new Style({
          // 꼭짓점 스타일 설정
          image: new Circle({
            radius: 6, // 원 반지름
            fill: new Fill({ color: "white" }), // 흰색 채우기
            stroke: new Stroke({ color: "#1976d2", width: 2 }), // 파란색 테두리
          }),
        }),
      });
      vertexLayer.setZIndex(200); // 모든 레이어의 위에 표시되도록 z-index 설정
      vertexLayerRef.current = vertexLayer; // 레이어 참조 저장
      vertexSourceRef.current = vertexSource; // 소스 참조 저장
      map.addLayer(vertexLayer); // 지도에 꼭짓점 레이어 추가

      // 지도 참조 저장
      mapRef.current = map;

      // 초기 GCP 데이터가 있으면 지도에 표시
      if (gcpData && Array.isArray(gcpData)) {
        const features = gcpData.map((item) => createPointFeature(item)); // 데이터를 피처로 변환
        gcpSource.clear(); // 기존 피처 제거
        gcpSource.addFeatures(features); // 새 피처 추가
        pointFeaturesRef.current = features; // 피처 참조 저장

        // 다음 객체 ID 설정 (기존 ID 중 최대값 + 1)
        nextObjectIdRef.current =
          gcpData.reduce(
            (max, item) => (item.objectId > max ? item.objectId : max),
            0
          ) + 1;
      }
    }, []);
  }
);
