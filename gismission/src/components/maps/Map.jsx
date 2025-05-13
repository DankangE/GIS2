import React, { useEffect, useRef, useCallback } from "react";
import { Map as OlMap, View } from "ol";
import { defaults as defaultControls } from "ol/control";
import { fromLonLat, toLonLat, get as getProjection } from "ol/proj";
import { Tile as TileLayer } from "ol/layer";
import { XYZ } from "ol/source";
import {
  createGcpPointsLayer,
  createPointFeature,
} from "./mapObjects/Objects.jsx";
import AddButton from "../../components/buttons/AddButton.jsx";
import DeleteButton from "../../components/buttons/DeleteButton.jsx";
import MoveButton from "../../components/buttons/MoveButton.jsx";
import { Select, Translate } from "ol/interaction";
import { click } from "ol/events/condition";
import "ol/ol.css";
import { Style, Circle, Fill, Stroke, Text } from "ol/style";

export default function MapTest() {
  console.log("MapTest 컴포넌트 렌더링");
  const mapContent = useRef(null);
  const mapRef = useRef(null);
  const gcpLayerRef = useRef(null);
  const pointFeaturesRef = useRef([]);
  const nextObjectIdRef = useRef(1);
  const isAddingPointRef = useRef(false);
  const isDeletingPointRef = useRef(false);
  const isMovingPointRef = useRef(false);
  const selectInteractionRef = useRef(null);
  const translateInteractionRef = useRef(null);

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
      // Select 및 Translate 상호작용 비활성화
      if (selectInteractionRef.current) {
        selectInteractionRef.current.setActive(false);
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
    const {
      vectorLayer: gcpLayer,
      loadGcpData,
      vectorSource,
    } = createGcpPointsLayer();
    gcpLayerRef.current = { layer: gcpLayer, source: vectorSource };

    // 지도 초기화
    const map = new OlMap({
      controls: defaultControls({ zoom: false, rotate: false }).extend([]),
      layers: [
        new TileLayer({
          source: new XYZ({
            url: "http://xdworld.vworld.kr:8080/2d/Base/202002/{z}/{x}/{y}.png",
          }),
        }),
        gcpLayer, // GCP 포인트 레이어만 추가
      ],
      view: new View({
        projection: getProjection("EPSG:3857"),
        center: fromLonLat([126.978, 37.5665]), // 서울시청 중심으로 시작
        zoom: 10, // 축소해서 전체 포인트를 볼 수 있도록 함
        minZoom: 7,
        maxZoom: 20,
      }),
      target: mapContent.current,
    });

    // Select 상호작용 생성 (포인트 선택용)
    const select = new Select({
      layers: [gcpLayer],
      condition: click,
      style: function (feature) {
        return new Style({
          image: new Circle({
            radius: 8,
            fill: new Fill({ color: "blue" }),
            stroke: new Stroke({ color: "yellow", width: 3 }),
          }),
          text: new Text({
            text: feature.get("properties")
              ? feature.get("properties").name
              : "",
            offsetY: -12,
            font: "12px sans-serif",
            fill: new Fill({ color: "black" }),
            stroke: new Stroke({ color: "white", width: 2 }),
          }),
        });
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
          props.lon = parseFloat(lon.toFixed(6));
          props.lat = parseFloat(lat.toFixed(6));

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

    // 초기에는 비활성화
    select.setActive(false);
    translate.setActive(false);

    // 지도에 상호작용 추가
    map.addInteraction(select);
    map.addInteraction(translate);

    // 상호작용 참조 저장
    selectInteractionRef.current = select;
    translateInteractionRef.current = translate;

    mapRef.current = map;

    // GCP 데이터 로드 및 지도에 표시
    loadGcpData().then((features) => {
      pointFeaturesRef.current = features;
      console.log("GCP 포인트가 지도에 표시되었습니다.");

      // 다음 objectId 설정
      const maxObjectId = features.reduce((max, feature) => {
        const props = feature.get("properties");
        return props && props.objectId > max ? props.objectId : max;
      }, 0);

      nextObjectIdRef.current = maxObjectId + 1;
    });

    // 지도 클릭 이벤트 핸들러
    const handleMapClick = (event) => {
      // 이동 모드일 때는 기본 Select/Translate 인터랙션이 처리
      if (isMovingPointRef.current) {
        return;
      }

      // 포인트 추가 모드인 경우
      if (isAddingPointRef.current) {
        const clickCoord = event.coordinate;
        const [lon, lat] = toLonLat(clickCoord);

        // 새 포인트 생성
        const newPoint = {
          objectId: nextObjectIdRef.current,
          name: `새 포인트 ${nextObjectIdRef.current}`,
          lat: parseFloat(lat.toFixed(6)),
          lon: parseFloat(lon.toFixed(6)),
          rel_alt: 0,
          note: "클릭으로 추가된 포인트",
        };

        console.log("새 포인트 생성:", newPoint);

        // 포인트 추가
        const newFeature = createPointFeature(newPoint);
        gcpLayerRef.current.source.addFeature(newFeature);

        // 데이터 업데이트
        pointFeaturesRef.current.push(newFeature);
        nextObjectIdRef.current++;

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
          gcpLayerRef.current.source.removeFeature(closestFeature);

          // 데이터 업데이트
          pointFeaturesRef.current = pointFeaturesRef.current.filter(
            (feature) => feature !== closestFeature
          );

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
    };

    // 이벤트 등록
    map.on("click", handleMapClick);

    return () => {
      map.setTarget(undefined);
      map.un("click", handleMapClick);
      map.removeInteraction(select);
      map.removeInteraction(translate);
    };
  }, [
    handleToggleAddingMode,
    handleToggleDeletingMode,
    handleToggleMovingMode,
  ]);

  return (
    <div
      className="gis-map-wrap"
      style={{ width: "100%", height: "100vh", position: "relative" }}
    >
      <div ref={mapContent} style={{ width: "100%", height: "100%" }}></div>
      <AddButton onToggleAddingMode={handleToggleAddingMode} />
      <DeleteButton onToggleDeletingMode={handleToggleDeletingMode} />
      <MoveButton onToggleMovingMode={handleToggleMovingMode} />
    </div>
  );
}
