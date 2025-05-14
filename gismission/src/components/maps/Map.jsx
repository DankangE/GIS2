import React, {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Map as OlMap, View } from "ol";
import { defaults as defaultControls } from "ol/control";
import { fromLonLat, toLonLat, get as getProjection } from "ol/proj";
import { Tile as TileLayer } from "ol/layer";
import { XYZ } from "ol/source";
import {
  createGcpPointsLayer,
  createPointFeature,
} from "./mapObjects/GCPObjects.jsx";
import AddButton from "../../components/buttons/AddButton.jsx";
import DeleteButton from "../../components/buttons/DeleteButton.jsx";
import MoveButton from "../../components/buttons/MoveButton.jsx";
import { Select, Translate } from "ol/interaction";
import { click } from "ol/events/condition";
import "ol/ol.css";
import { Style, Circle, Fill, Stroke, Text } from "ol/style";

// 상수 정의
// 초기 설정
const MAP_CONFIG = {
  INITIAL_CENTER: [126.978, 37.5665], // 서울시청
  INITIAL_ZOOM: 10,
  MIN_ZOOM: 7,
  MAX_ZOOM: 20,
  PROJECTION: "EPSG:3857",
  TILE_URL: "http://xdworld.vworld.kr:8080/2d/Base/202002/{z}/{x}/{y}.png",
};

// 포인트 스타일 정의
const POINT_STYLE = {
  SELECTED: new Style({
    image: new Circle({
      radius: 8,
      fill: new Fill({ color: "blue" }),
      stroke: new Stroke({ color: "yellow", width: 3 }),
    }),
    text: new Text({
      offsetY: -12,
      font: "12px sans-serif",
      fill: new Fill({ color: "black" }),
      stroke: new Stroke({ color: "white", width: 2 }),
    }),
  }),
  DEFAULT: new Style({
    image: new Circle({
      radius: 5,
      fill: new Fill({ color: "blue" }),
      stroke: new Stroke({ color: "white", width: 1.5 }),
    }),
  }),
};

const MapTest = forwardRef(
  (
    {
      gcpData,
      modifiedData,
      handleMapPointAdded,
      handleFeatureMoved,
      handleFeatureDeleted,
      currentTab,
      onFeatureSelect,
    },
    ref
  ) => {
    console.log("MapTest 컴포넌트 렌더링");
    const mapContent = useRef(null);
    const mapRef = useRef(null);
    const gcpLayerRef = useRef(null);
    const landingLayerRef = useRef(null);
    const missionLayerRef = useRef(null);
    const pointFeaturesRef = useRef([]);
    const nextObjectIdRef = useRef(1);
    const isAddingPointRef = useRef(false);
    const isDeletingPointRef = useRef(false);
    const isMovingPointRef = useRef(false);
    const selectInteractionRef = useRef(null);
    const translateInteractionRef = useRef(null);

    // 현재 탭에 맞는 레이어 반환
    const getCurrentLayer = () => {
      switch (currentTab) {
        case 0:
          return gcpLayerRef.current;
        case 1:
          return landingLayerRef.current;
        case 2:
          return missionLayerRef.current;
        default:
          return gcpLayerRef.current;
      }
    };

    // 포인트 추가 모드 토글 핸들러
    const handleToggleAddingMode = useCallback((isAdding) => {
      isAddingPointRef.current = isAdding;

      // 다른 모드들 비활성화
      if (isAdding) {
        if (isDeletingPointRef.current) {
          isDeletingPointRef.current = false;
          if (handleToggleDeletingMode.reset) {
            handleToggleDeletingMode.reset(false);
          }
        }
        if (isMovingPointRef.current) {
          isMovingPointRef.current = false;
          if (handleToggleMovingMode.reset) {
            handleToggleMovingMode.reset(false);
          }
        }

        // Select 및 Translate 상호작용 비활성화
        if (selectInteractionRef.current) {
          selectInteractionRef.current.setActive(false);
        }
        if (translateInteractionRef.current) {
          translateInteractionRef.current.setActive(false);
        }
      }

      console.log(
        isAdding ? "포인트 추가 모드 활성화" : "포인트 추가 모드 비활성화"
      );
    }, []);

    // 포인트 삭제 모드 토글 핸들러
    const handleToggleDeletingMode = useCallback((isDeleting) => {
      isDeletingPointRef.current = isDeleting;

      // 다른 모드들 비활성화
      if (isDeleting) {
        if (isAddingPointRef.current) {
          isAddingPointRef.current = false;
          if (handleToggleAddingMode.reset) {
            handleToggleAddingMode.reset(false);
          }
        }
        if (isMovingPointRef.current) {
          isMovingPointRef.current = false;
          if (handleToggleMovingMode.reset) {
            handleToggleMovingMode.reset(false);
          }
        }

        // Select 및 Translate 상호작용 비활성화
        if (selectInteractionRef.current) {
          selectInteractionRef.current.setActive(false);
        }
        if (translateInteractionRef.current) {
          translateInteractionRef.current.setActive(false);
        }
      }

      console.log(
        isDeleting ? "포인트 삭제 모드 활성화" : "포인트 삭제 모드 비활성화"
      );
    }, []);

    // 포인트 이동 모드 토글 핸들러
    const handleToggleMovingMode = useCallback((isMoving) => {
      isMovingPointRef.current = isMoving;

      // 다른 모드들 비활성화
      if (isMoving) {
        if (isAddingPointRef.current) {
          isAddingPointRef.current = false;
          if (handleToggleAddingMode.reset) {
            handleToggleAddingMode.reset(false);
          }
        }
        if (isDeletingPointRef.current) {
          isDeletingPointRef.current = false;
          if (handleToggleDeletingMode.reset) {
            handleToggleDeletingMode.reset(false);
          }
        }
        // Select 및 Translate 상호작용 활성화
        if (selectInteractionRef.current) {
          selectInteractionRef.current.setActive(true);
        }
        if (translateInteractionRef.current) {
          translateInteractionRef.current.setActive(true);
        }
      } else {
        // 이동 모드 해제 시 Select 활성화
        if (selectInteractionRef.current) {
          selectInteractionRef.current.setActive(true);
          // 선택 해제
          selectInteractionRef.current.getFeatures().clear();
        }
        if (translateInteractionRef.current) {
          translateInteractionRef.current.setActive(false);
        }
      }
      console.log(
        isMoving ? "포인트 이동 모드 활성화" : "포인트 이동 모드 비활성화"
      );
    }, []);

    useEffect(() => {
      console.log("useEffect 실행 - 지도 초기화");
      if (!mapContent.current) {
        return;
      }

      // GCP 포인트 레이어 생성
      const { vectorLayer: gcpLayer, vectorSource: gcpSource } =
        createGcpPointsLayer();
      gcpLayerRef.current = { layer: gcpLayer, source: gcpSource };

      // TODO: 이착륙 레이어 생성
      // const { vectorLayer: landingLayer, vectorSource: landingSource } = createLandingLayer();
      // landingLayerRef.current = { layer: landingLayer, source: landingSource };

      // TODO: 임무 레이어 생성
      // const { vectorLayer: missionLayer, vectorSource: missionSource } = createMissionLayer();
      // missionLayerRef.current = { layer: missionLayer, source: missionSource };

      // 지도 초기화
      const map = new OlMap({
        controls: defaultControls({ zoom: false, rotate: false }).extend([]),
        layers: [
          new TileLayer({
            source: new XYZ({
              url: MAP_CONFIG.TILE_URL,
            }),
          }),
          gcpLayer, // GCP 포인트 레이어만 추가
          // TODO: 다른 레이어들 추가
        ],
        view: new View({
          projection: getProjection(MAP_CONFIG.PROJECTION),
          center: fromLonLat(MAP_CONFIG.INITIAL_CENTER),
          zoom: MAP_CONFIG.INITIAL_ZOOM,
          minZoom: MAP_CONFIG.MIN_ZOOM,
          maxZoom: MAP_CONFIG.MAX_ZOOM,
        }),
        target: mapContent.current,
      });

      // Select 상호작용 생성 (포인트 선택용)
      const select = new Select({
        layers: [gcpLayer],
        condition: click,
        style: (feature) => {
          const style = POINT_STYLE.SELECTED.clone();
          style.getText().setText(feature.get("properties")?.name || "");
          return style;
        },
      });

      // Translate 상호작용 생성 (포인트 이동용)
      const translate = new Translate({
        features: select.getFeatures(), // Select에서 선택된 피처를 사용
      });

      // 이동 완료 이벤트 처리
      translate.on("translateend", function (event) {
        const features = event.features.getArray();
        features.forEach((feature) => {
          // 새 좌표 계산
          const geometry = feature.getGeometry();
          const coords = geometry.getCoordinates();
          const [lon, lat] = toLonLat(coords);

          // 피처 속성 업데이트
          const props = feature.get("properties");
          if (props) {
            props.lon = parseFloat(lon);
            props.lat = parseFloat(lat);
            feature.set("properties", { ...props });
            feature.changed();

            // 상위 콜백 호출 (그리드에 위도/경도 반영)
            if (typeof handleFeatureMoved === "function") {
              handleFeatureMoved({
                objectId: props.objectId,
                lat: props.lat,
                lon: props.lon,
              });
            }

            // 위치 변경 로그
            console.log(`"${props.name}" 이동 완료:`, {
              포인트ID: props.objectId,
              이름: props.name,
              새위치: {
                위도: props.lat,
                경도: props.lon,
              },
              메모: props.note || "없음",
            });
          }
        });
      });

      // 초기에는 select 활성화
      select.setActive(true);
      translate.setActive(false);

      // 지도에 상호작용 추가
      map.addInteraction(select);
      map.addInteraction(translate);

      // 상호작용 참조 저장
      selectInteractionRef.current = select;
      translateInteractionRef.current = translate;

      mapRef.current = map;

      // gcpData를 지도에 표시
      if (gcpData && Array.isArray(gcpData)) {
        const features = gcpData.map((item) => createPointFeature(item));
        gcpSource.clear();
        gcpSource.addFeatures(features);
        pointFeaturesRef.current = features;
        // 다음 objectId 계산
        const maxObjectId = gcpData.reduce(
          (max, item) => (item.objectId > max ? item.objectId : max),
          0
        );
        nextObjectIdRef.current = maxObjectId + 1;
      }

      // 지도 클릭 이벤트 핸들러
      const handleMapClick = (event) => {
        // 이동 모드일 때는 기본 Select/Translate 인터랙션이 처리
        if (isMovingPointRef.current) {
          console.log("[handleMapClick] 이동 모드 - 무시");
          return;
        }

        // 포인트 추가 모드인 경우
        if (isAddingPointRef.current) {
          console.log("[handleMapClick] 추가 모드");
          const clickCoord = event.coordinate;
          const [lon, lat] = toLonLat(clickCoord);

          // 새 포인트 생성
          const newPoint = {
            objectId: nextObjectIdRef.current,
            name: `새 포인트`,
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            rel_alt: 0,
            note: "",
          };

          console.log("새 포인트 생성:", newPoint);

          // 포인트 추가
          const newFeature = createPointFeature(newPoint);
          gcpSource.addFeature(newFeature);

          // 데이터 업데이트
          pointFeaturesRef.current.push(newFeature);
          nextObjectIdRef.current++;

          // 상위 콜백 호출 (그리드에 행 추가)
          if (typeof handleMapPointAdded === "function") {
            handleMapPointAdded(newPoint);
          }

          // 모드 초기화 - AddButton 컴포넌트에게 알림
          isAddingPointRef.current = false;

          // 포인트 추가가 완료되면 버튼 상태 초기화
          if (handleToggleAddingMode.reset) {
            handleToggleAddingMode.reset(false);
          } else {
            handleToggleAddingMode(false);
          }
          return;
        }

        // 포인트 삭제 모드인 경우
        if (isDeletingPointRef.current) {
          console.log("[handleMapClick] 삭제 모드");
          // 클릭한 지점에서 가장 가까운 피처 찾기
          const clickPixel = map.getEventPixel(event.originalEvent);
          let closestFeature = null;

          map.forEachFeatureAtPixel(clickPixel, (feature) => {
            closestFeature = feature;
            return true; // 첫 번째 피처만 반환
          });

          if (closestFeature) {
            const featureProps = closestFeature.get("properties");
            console.log("삭제할 포인트:", featureProps);

            // 피처 삭제
            gcpSource.removeFeature(closestFeature);

            // 데이터 업데이트
            pointFeaturesRef.current = pointFeaturesRef.current.filter(
              (feature) => feature !== closestFeature
            );

            // 상위 컴포넌트에 삭제 알림
            if (typeof handleFeatureDeleted === "function") {
              handleFeatureDeleted(featureProps.objectId);
            }

            console.log(`포인트 "${featureProps.name}" 삭제됨`);

            // 모드 초기화 - DeleteButton 컴포넌트에게 알림
            isDeletingPointRef.current = false;

            // 포인트 삭제가 완료되면 버튼 상태 초기화
            if (handleToggleDeletingMode.reset) {
              handleToggleDeletingMode.reset(false);
            } else {
              handleToggleDeletingMode(false);
            }
          } else {
            console.log("삭제할 포인트가 없습니다.");
          }
        }

        // 일반 상태에서 클릭
        console.log("[handleMapClick] 일반 상태에서 클릭", event);
      };

      // 이벤트 등록
      map.on("click", handleMapClick);

      // Select 이벤트에서 상위 콜백 호출
      select.on("select", (e) => {
        console.log("[Select interaction] select 이벤트", e);
        if (e.selected && e.selected.length > 0) {
          const objectId = e.selected[0].get("properties").objectId;
          if (typeof onFeatureSelect === "function") {
            onFeatureSelect(objectId);
          }
        }
      });

      return () => {
        map.setTarget(undefined);
        map.un("click", handleMapClick);
        map.removeInteraction(select);
        map.removeInteraction(translate);
      };
    }, [
      currentTab,
      gcpData,
      handleMapPointAdded,
      handleFeatureMoved,
      handleFeatureDeleted,
      onFeatureSelect,
    ]);

    // gcpData가 변경될 때마다 레이어 업데이트
    useEffect(() => {
      if (gcpLayerRef.current && gcpData && Array.isArray(gcpData)) {
        const { source } = gcpLayerRef.current;
        const features = gcpData.map((item) => createPointFeature(item));
        source.clear();
        source.addFeatures(features);
        pointFeaturesRef.current = features;
        // 다음 objectId 계산
        const maxObjectId = gcpData.reduce(
          (max, item) => (item.objectId > max ? item.objectId : max),
          0
        );
        nextObjectIdRef.current = maxObjectId + 1;
      }
    }, [gcpData]);

    // addPoint, updateFeature 메서드 구현
    useImperativeHandle(ref, () => ({
      addPoint: (row) => {
        if (!gcpLayerRef.current || !row) return;
        const { source } = gcpLayerRef.current;
        // 이미 해당 objectId의 포인트가 있으면 추가하지 않음
        const exists = source.getFeatures().some((f) => {
          const props = f.get("properties");
          return props && props.objectId === row.objectId;
        });
        if (
          !exists &&
          row.lat &&
          row.lon &&
          !isNaN(Number(row.lat)) &&
          !isNaN(Number(row.lon))
        ) {
          const feature = createPointFeature(row);
          source.addFeature(feature);
        }
      },
      updateFeature: (row) => {
        if (!gcpLayerRef.current || !row) return;
        const { source } = gcpLayerRef.current;
        const features = source.getFeatures();
        const feature = features.find((f) => {
          const props = f.get("properties");
          return props && props.objectId === row.objectId;
        });
        if (feature) {
          // 이름 변경
          if (row.name !== undefined) {
            // 스타일 객체가 없으면 새로 생성
            let style = feature.getStyle();
            if (!style) {
              style = POINT_STYLE.SELECTED.clone();
            }
            if (style.getText()) {
              style.getText().setText(row.name);
            }
            feature.setStyle(style);
            // properties도 갱신
            const props = feature.get("properties");
            props.name = row.name;
            feature.set("properties", { ...props });
            feature.changed();
          }
          // 위치 변경
          if (
            row.lat !== undefined &&
            row.lon !== undefined &&
            !isNaN(Number(row.lat)) &&
            !isNaN(Number(row.lon))
          ) {
            const ol = require("ol");
            const { fromLonLat } = ol.proj || require("ol/proj");
            const coords = fromLonLat([Number(row.lon), Number(row.lat)]);
            feature.getGeometry().setCoordinates(coords);
          }
        }
      },
      deleteFeature: (objectId) => {
        if (!gcpLayerRef.current || !objectId) return;
        const { source } = gcpLayerRef.current;
        const features = source.getFeatures();
        const feature = features.find((f) => {
          const props = f.get("properties");
          return props && props.objectId === objectId;
        });
        if (feature) {
          source.removeFeature(feature);
        }
      },
      highlightFeatureAndPan: (objectId) => {
        if (!gcpLayerRef.current || !mapRef.current || !objectId) return;
        const { source } = gcpLayerRef.current;
        const features = source.getFeatures();
        // 모든 feature 스타일 초기화 (라벨 동적 적용)
        features.forEach((feature) => {
          const name = feature.get("properties")?.name || "";
          feature.setStyle(
            new Style({
              image: new Circle({
                radius: 5,
                fill: new Fill({ color: "blue" }),
                stroke: new Stroke({ color: "white", width: 1.5 }),
              }),
              text: new Text({
                text: name,
                offsetY: -12,
                font: "10px sans-serif",
                fill: new Fill({ color: "black" }),
                stroke: new Stroke({ color: "white", width: 2 }),
              }),
            })
          );
          feature.changed();
        });
        const feature = features.find((f) => {
          const props = f.get("properties");
          return props && props.objectId === objectId;
        });
        if (feature) {
          const name = feature.get("properties")?.name || "";
          let style = new Style({
            image: new Circle({
              radius: 8,
              fill: new Fill({ color: "blue" }),
              stroke: new Stroke({ color: "yellow", width: 3 }),
            }),
            text: new Text({
              text: name,
              offsetY: -12,
              font: "12px sans-serif",
              fill: new Fill({ color: "black" }),
              stroke: new Stroke({ color: "white", width: 2 }),
            }),
          });
          feature.setStyle(style);
          feature.changed();
          const geometry = feature.getGeometry();
          if (geometry) {
            const coords = geometry.getCoordinates();
            mapRef.current.getView().animate({ center: coords, duration: 500 });
          }
        }
      },
    }));

    return (
      <div
        className="gis-map-wrap"
        style={{ width: "100%", height: "100vh", position: "relative" }}
      >
        <div ref={mapContent} style={{ width: "100%", height: "100%" }}></div>
        {currentTab === 0 && (
          <>
            <AddButton onToggleAddingMode={handleToggleAddingMode} />
            <DeleteButton onToggleDeletingMode={handleToggleDeletingMode} />
            <MoveButton onToggleMovingMode={handleToggleMovingMode} />
          </>
        )}
        {currentTab === 1 && (
          <>
            <AddButton onToggleAddingMode={handleToggleAddingMode} />
            <DeleteButton onToggleDeletingMode={handleToggleDeletingMode} />
            <MoveButton onToggleMovingMode={handleToggleMovingMode} />
          </>
        )}
        {/* TODO: 다른 탭의 버튼들 추가 */}
      </div>
    );
  }
);

export default MapTest;
