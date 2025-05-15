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
import { createLandingPointsLayer } from "./mapObjects/LandingObjects.jsx";
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
  INITIAL_ZOOM: 15,
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
    const gcpGridRef = useRef(null);

    // 현재 탭에 맞는 레이어 반환
    const getCurrentLayer = useCallback(() => {
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
    }, [currentTab]);

    // 포인트 추가 모드 토글 핸들러
    const handleToggleAddingMode = useCallback((isAdding) => {
      isAddingPointRef.current = isAdding;
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
        if (selectInteractionRef.current) {
          selectInteractionRef.current.setActive(false);
        }
        if (translateInteractionRef.current) {
          translateInteractionRef.current.setActive(false);
        }
      }
    }, []);

    // 포인트 삭제 모드 토글 핸들러
    const handleToggleDeletingMode = useCallback((isDeleting) => {
      isDeletingPointRef.current = isDeleting;
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
        if (selectInteractionRef.current) {
          selectInteractionRef.current.setActive(false);
        }
        if (translateInteractionRef.current) {
          translateInteractionRef.current.setActive(false);
        }
      }
    }, []);

    // 포인트 이동 모드 토글 핸들러
    const handleToggleMovingMode = useCallback((isMoving) => {
      isMovingPointRef.current = isMoving;
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
        if (selectInteractionRef.current) {
          selectInteractionRef.current.setActive(true);
        }
        if (translateInteractionRef.current) {
          translateInteractionRef.current.setActive(true);
        }
      } else {
        if (selectInteractionRef.current) {
          selectInteractionRef.current.setActive(true);
          selectInteractionRef.current.getFeatures().clear();
        }
        if (translateInteractionRef.current) {
          translateInteractionRef.current.setActive(false);
        }
      }
    }, []);

    // 지도 초기화 (컴포넌트 마운트 시 한 번만 실행)
    useEffect(() => {
      if (!mapContent.current) return;

      const { vectorLayer: gcpLayer, vectorSource: gcpSource } =
        createGcpPointsLayer();
      gcpLayerRef.current = { layer: gcpLayer, source: gcpSource };

      const { vectorLayer: landingLayer, vectorSource: landingSource } =
        createLandingPointsLayer();
      landingLayerRef.current = { layer: landingLayer, source: landingSource };

      const map = new OlMap({
        controls: defaultControls({ zoom: false, rotate: false }).extend([]),
        layers: [
          new TileLayer({
            source: new XYZ({
              url: MAP_CONFIG.TILE_URL,
            }),
          }),
          gcpLayer,
          landingLayer,
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

      const select = new Select({
        layers: [gcpLayer],
        condition: click,
        style: (feature) => {
          const style = POINT_STYLE.SELECTED.clone();
          style.getText().setText(feature.get("properties")?.name || "");
          return style;
        },
      });

      const translate = new Translate({
        features: select.getFeatures(),
      });

      translate.on("translateend", function (event) {
        const features = event.features.getArray();
        features.forEach((feature) => {
          const geometry = feature.getGeometry();
          const coords = geometry.getCoordinates();
          const [lon, lat] = toLonLat(coords);

          const props = feature.get("properties");
          if (props) {
            props.lon = parseFloat(lon);
            props.lat = parseFloat(lat);
            feature.set("properties", { ...props });
            feature.changed();

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

      select.setActive(true);
      translate.setActive(false);

      map.addInteraction(select);
      map.addInteraction(translate);

      selectInteractionRef.current = select;
      translateInteractionRef.current = translate;
      mapRef.current = map;

      if (gcpData && Array.isArray(gcpData)) {
        const features = gcpData.map((item) => createPointFeature(item));
        gcpSource.clear();
        gcpSource.addFeatures(features);
        pointFeaturesRef.current = features;
        nextObjectIdRef.current =
          gcpData.reduce(
            (max, item) => (item.objectId > max ? item.objectId : max),
            0
          ) + 1;
      }

      const handleMapClick = (event) => {
        if (isMovingPointRef.current) return;

        if (isAddingPointRef.current) {
          const clickCoord = event.coordinate;
          const [lon, lat] = toLonLat(clickCoord);

          const newPoint = {
            objectId: nextObjectIdRef.current,
            name: `새 포인트`,
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            rel_alt: 0,
            note: "",
          };

          const newFeature = createPointFeature(newPoint);
          gcpSource.addFeature(newFeature);
          pointFeaturesRef.current.push(newFeature);
          nextObjectIdRef.current++;

          if (typeof handleMapPointAdded === "function") {
            handleMapPointAdded(newPoint);
          }

          isAddingPointRef.current = false;
          if (handleToggleAddingMode.reset) {
            handleToggleAddingMode.reset(false);
          }
          return;
        }

        if (isDeletingPointRef.current) {
          const clickPixel = map.getEventPixel(event.originalEvent);
          let closestFeature = null;

          map.forEachFeatureAtPixel(clickPixel, (feature) => {
            closestFeature = feature;
            return true;
          });

          if (closestFeature) {
            const featureProps = closestFeature.get("properties");
            const currentObjectId = featureProps.objectId;

            gcpSource.removeFeature(closestFeature);
            pointFeaturesRef.current = pointFeaturesRef.current.filter(
              (feature) => feature !== closestFeature
            );

            if (typeof handleFeatureDeleted === "function") {
              handleFeatureDeleted(currentObjectId);
            }

            if (typeof onFeatureSelect === "function") {
              const nextFeature = pointFeaturesRef.current.find(
                (feature) =>
                  feature.get("properties").objectId > currentObjectId
              );
              if (nextFeature) {
                onFeatureSelect(nextFeature.get("properties").objectId);
              }
            }

            isDeletingPointRef.current = false;
            if (handleToggleDeletingMode.reset) {
              handleToggleDeletingMode.reset(false);
            }
          }
        }
      };

      map.on("click", handleMapClick);

      select.on("select", (e) => {
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
    }, []); // 컴포넌트 마운트 시 한 번만 실행

    // 저장 버튼 클릭 시 데이터 업데이트
    useEffect(() => {
      if (gcpLayerRef.current && gcpData && Array.isArray(gcpData)) {
        const { source } = gcpLayerRef.current;
        const features = gcpData.map((item) => createPointFeature(item));
        source.clear();
        source.addFeatures(features);
        pointFeaturesRef.current = features;
        nextObjectIdRef.current =
          gcpData.reduce(
            (max, item) => (item.objectId > max ? item.objectId : max),
            0
          ) + 1;
      }
    }, [gcpData]); // gcpData가 변경될 때만 실행 (저장 버튼 클릭 시)

    // 탭 변경 시 선택 초기화
    useEffect(() => {
      if (selectInteractionRef.current) {
        selectInteractionRef.current.getFeatures().clear();
      }
      if (typeof onFeatureSelect === "function") {
        onFeatureSelect(null);
      }
      if (gcpGridRef.current) {
        gcpGridRef.current.clearSelection();
      }
    }, [currentTab, onFeatureSelect]);

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
