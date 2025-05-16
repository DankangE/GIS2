import React, {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
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
import MissionObjects from "./mapObjects/MissionObjects.jsx";
import AddButton from "../../components/buttons/AddButton.jsx";
import DeleteButton from "../../components/buttons/DeleteButton.jsx";
import MoveButton from "../../components/buttons/MoveButton.jsx";
import { Select, Translate } from "ol/interaction";
import { click, shiftKeyOnly } from "ol/events/condition";
import "ol/ol.css";
import { Style, Circle, Fill, Stroke, Text, Icon } from "ol/style";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Draw from "ol/interaction/Draw";
import Snap from "ol/interaction/Snap";
import MissionButton from "../../components/buttons/MissionButton.jsx";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Modify from "ol/interaction/Modify";
import GeoJSON from "ol/format/GeoJSON";
import { getCenter as getExtentCenter } from "ol/extent";
import TransformInteraction from "ol-ext/interaction/Transform";
import "ol-ext/dist/ol-ext.css";

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
      onMissionFeatureAdded,
    },
    ref
  ) => {
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
    const polygonLayerRef = useRef(null);
    const polygonSourceRef = useRef(null);
    const drawInteractionRef = useRef(null);
    const snapInteractionRef = useRef(null);
    const vertexLayerRef = useRef(null);
    const vertexSourceRef = useRef(null);
    const modifyInteractionRef = useRef(null);
    const [missionModalOpen, setMissionModalOpen] = React.useState(false);
    const [drawType, setDrawType] = React.useState("Polygon");
    const [selectedFeatureId, setSelectedFeatureId] = React.useState(null);
    const [missionData, setMissionData] = useState(null);

    const handleMissionButtonClick = () => setMissionModalOpen(true);
    const handleMissionModalClose = () => setMissionModalOpen(false);
    const handleDrawTypeChange = (e) => setDrawType(e.target.value);

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

      // 폴리곤 레이어 및 인터랙션 생성 (초기화만, 지도에는 추가하지 않음)
      const polygonSource = new VectorSource();
      const polygonLayer = new VectorLayer({ source: polygonSource });
      polygonLayer.setZIndex(100); // 오브젝트 위에 보이도록
      polygonLayerRef.current = polygonLayer;
      polygonSourceRef.current = polygonSource;
      const draw = new Draw({ source: polygonSource, type: "Polygon" });
      const snap = new Snap({ source: polygonSource });
      drawInteractionRef.current = draw;
      snapInteractionRef.current = snap;

      // --- 꼭짓점 마커용 vertexLayer 추가 ---
      const vertexSource = new VectorSource();
      const vertexLayer = new VectorLayer({
        source: vertexSource,
        style: new Style({
          image: new Circle({
            radius: 6,
            fill: new Fill({ color: "white" }),
            stroke: new Stroke({ color: "#1976d2", width: 2 }),
          }),
        }),
      });
      vertexLayer.setZIndex(200);
      vertexLayerRef.current = vertexLayer;
      vertexSourceRef.current = vertexSource;
      map.addLayer(vertexLayer);
      // --- 꼭짓점 마커용 vertexLayer 추가 끝 ---

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
        // 폴리곤 관련 정리
        map.removeLayer(polygonLayer);
        map.removeInteraction(draw);
        map.removeInteraction(snap);
      };
    }, []); // 최초 1회만

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

    // 탭 변경 시 폴리곤/오브젝트 레이어 on/off
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      const polygonLayer = polygonLayerRef.current;
      // GCP/이착륙 레이어
      const gcpLayer = gcpLayerRef.current?.layer;
      const landingLayer = landingLayerRef.current?.layer;
      // 임무탭이면 폴리곤만 보이게
      if (currentTab === 2) {
        if (gcpLayer) map.removeLayer(gcpLayer);
        if (landingLayer) map.removeLayer(landingLayer);
        if (
          polygonLayer &&
          !map.getLayers().getArray().includes(polygonLayer)
        ) {
          map.addLayer(polygonLayer);
        }
        // draw/snap 인터랙션은 startMissionDraw에서만 추가
      } else {
        // GCP/이착륙 레이어 복구
        if (gcpLayer && !map.getLayers().getArray().includes(gcpLayer)) {
          map.getLayers().insertAt(1, gcpLayer);
        }
        if (
          landingLayer &&
          !map.getLayers().getArray().includes(landingLayer)
        ) {
          map.getLayers().insertAt(2, landingLayer);
        }
        // 폴리곤/인터랙션 제거
        if (polygonLayer && map.getLayers().getArray().includes(polygonLayer)) {
          map.removeLayer(polygonLayer);
        }
        // draw/snap 인터랙션 제거
        if (
          drawInteractionRef.current &&
          map.getInteractions().getArray().includes(drawInteractionRef.current)
        ) {
          map.removeInteraction(drawInteractionRef.current);
        }
        if (
          snapInteractionRef.current &&
          map.getInteractions().getArray().includes(snapInteractionRef.current)
        ) {
          map.removeInteraction(snapInteractionRef.current);
        }
      }
    }, [currentTab]);

    // 임무탭 드로우 시작
    const startMissionDraw = () => {
      const map = mapRef.current;
      if (!map) return;
      const polygonSource = polygonSourceRef.current;
      // 기존 draw/snap 제거
      if (drawInteractionRef.current)
        map.removeInteraction(drawInteractionRef.current);
      if (snapInteractionRef.current)
        map.removeInteraction(snapInteractionRef.current);
      // 새 draw 생성 (기존 Feature 개수와 상관없이)
      const draw = new Draw({
        source: polygonSource,
        type: drawType, // "Point", "LineString", "Circle", "Polygon"
      });
      drawInteractionRef.current = draw;
      map.addInteraction(draw);
      // snap도 새로
      const snap = new Snap({ source: polygonSource });
      snapInteractionRef.current = snap;
      map.addInteraction(snap);
      // 하나 그려지면 draw 인터랙션만 제거, Feature는 남김
      draw.on("drawend", (event) => {
        setTimeout(() => {
          map.removeInteraction(draw);
          map.removeInteraction(snap);
        }, 100);

        // 기존 콘솔 출력
        const feature = event.feature;
        const geometry = feature.getGeometry();

        // 다음 objectId 계산
        // missionData의 배열 수에 맞게 nextId를 설정
        const nextId =
          missionData && Array.isArray(missionData.features)
            ? missionData.features.length + 1
            : 1;

        // GeoJSON 객체로 변환
        const geojsonFormat = new GeoJSON();
        const geojsonObj = geojsonFormat.writeFeatureObject(feature);

        // GeoJSON 객체 수정
        geojsonObj.objectId = "feature" + nextId;
        geojsonObj.properties = {
          name: "",
          notes: "",
        };

        // 원본 feature에도 같은 속성 설정
        feature.set("objectId", "feature" + nextId);
        feature.set("name", "");
        feature.set("notes", "");

        // 임무 그리드에 행 추가 이벤트 발생 (부모 컴포넌트에서 처리)
        if (typeof onMissionFeatureAdded === "function" && currentTab === 2) {
          onMissionFeatureAdded({
            objectId: "feature" + nextId,
            type: geometry.getType(),
            properties: {
              name: "",
              notes: "",
            },
            geometry: {
              type: geometry.getType(),
              coordinates: geometry.getCoordinates(),
              radius:
                geometry.getType() === "Circle" ? geometry.getRadius() : null,
            },
          });
        }
      });
    };
    const handleMissionModalConfirm = () => {
      setMissionModalOpen(false);
      startMissionDraw();
    };

    // missionData.json fetch면
    useEffect(() => {
      fetch("/jsondatas/missionData.json")
        .then((res) => res.json())
        .then((data) => {
          setMissionData(data);
        })
        .catch((err) => {
          console.error("missionData.json load error:", err);
        });
    }, []);

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
        if (!objectId) return;

        // 임무탭이면 polygonSource에서 찾기
        if (currentTab === 2 && polygonSourceRef.current) {
          const features = polygonSourceRef.current.getFeatures();

          // 모든 feature 스타일 초기화
          features.forEach((feature) => {
            feature.setStyle(null);
            feature.changed();
          });

          // objectId로 feature 찾기 (문자열 변환 비교)
          const feature = features.find((f) => {
            const fid = f.get("objectId");
            const isEqual = String(fid) === String(objectId);
            return isEqual;
          });

          if (feature) {
            // geometry 타입에 따라 하이라이트 스타일 적용
            const geometry = feature.getGeometry();
            if (geometry) {
              const type = geometry.getType();

              let style = null;
              if (type === "Point") {
                style = new Style({
                  image: new Circle({
                    radius: 12,
                    fill: new Fill({ color: "#fffde7" }),
                    stroke: new Stroke({ color: "#ff9800", width: 5 }),
                  }),
                });
              } else if (type === "LineString") {
                style = new Style({
                  stroke: new Stroke({ color: "#ff9800", width: 6 }),
                });
              } else if (type === "Polygon") {
                style = new Style({
                  fill: new Fill({ color: "rgba(255, 235, 59, 0.3)" }),
                  stroke: new Stroke({ color: "#ff9800", width: 4 }),
                });
              } else if (type === "Circle") {
                style = new Style({
                  fill: new Fill({ color: "rgba(255, 235, 59, 0.2)" }),
                  stroke: new Stroke({ color: "#ff9800", width: 4 }),
                });
              }

              if (style) {
                feature.setStyle(style);
                feature.changed();
              }

              // 패닝 - geometry 타입별로 다르게 처리
              if (type === "Point") {
                const coords = geometry.getCoordinates();
                if (Array.isArray(coords) && coords.length >= 2) {
                  mapRef.current
                    .getView()
                    .animate({ center: coords, duration: 500 });
                }
              } else if (type === "LineString") {
                const coords = geometry.getCoordinates();
                if (Array.isArray(coords) && coords.length > 0) {
                  // 첫번째 포인트로 패닝
                  mapRef.current
                    .getView()
                    .animate({ center: coords[0], duration: 500 });
                }
              } else if (type === "Polygon") {
                const coords = geometry.getCoordinates();
                if (
                  Array.isArray(coords) &&
                  coords.length > 0 &&
                  Array.isArray(coords[0]) &&
                  coords[0].length > 0
                ) {
                  // 폴리곤의 첫번째 포인트로 패닝
                  mapRef.current
                    .getView()
                    .animate({ center: coords[0][0], duration: 500 });
                }
              } else if (type === "Circle") {
                const coords = geometry.getCenter();
                if (coords) {
                  mapRef.current
                    .getView()
                    .animate({ center: coords, duration: 500 });
                }
              }
            }
          }
          return;
        }

        // 그 외(GCP/이착륙)는 기존대로 gcpLayer에서 찾기
        if (!gcpLayerRef.current || !mapRef.current) return;
        const { source } = gcpLayerRef.current;
        const features = source.getFeatures();
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
          const fid = props && props.objectId;
          const isEqual = String(fid) === String(objectId);
          return isEqual;
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

    // Feature 클릭 시 선택된 Feature만 꼭짓점 마커 표시
    useEffect(() => {
      const polygonSource = polygonSourceRef.current;
      const map = mapRef.current;
      if (!polygonSource || !map) return;

      const handleFeatureClick = (evt) => {
        map.forEachFeatureAtPixel(evt.pixel, (feature) => {
          if (polygonSource.getFeatures().includes(feature)) {
            // feature의 objectId 가져오기
            const objectId = feature.get("objectId");

            // feature ID 설정 (꼭짓점 마커용)
            setSelectedFeatureId(
              feature.ol_uid || feature.getId() || feature.uid
            );

            // 그리드 행 선택 요청
            if (typeof onFeatureSelect === "function" && currentTab === 2) {
              onFeatureSelect(objectId);
            }

            return true;
          }
          return false;
        });
      };
      map.on("click", handleFeatureClick);
      return () => {
        map.un("click", handleFeatureClick);
      };
    }, [currentTab, onFeatureSelect]);

    // 꼭짓점 마커 동기화 함수 (선택된 Feature만, 원은 제외)
    function updateVertexMarkers() {
      const vertexSource = vertexSourceRef.current;
      const polygonSource = polygonSourceRef.current;
      if (!vertexSource || !polygonSource) return;
      vertexSource.clear();
      if (!selectedFeatureId) return;
      const feature = polygonSource
        .getFeatures()
        .find((f) => (f.ol_uid || f.getId() || f.uid) === selectedFeatureId);
      if (!feature) return;
      const geom = feature.getGeometry();
      if (!geom) return;
      let coordsArr = [];
      if (geom.getType() === "Point") {
        coordsArr = [geom.getCoordinates()];
      } else if (geom.getType() === "LineString") {
        coordsArr = geom.getCoordinates();
      } else if (geom.getType() === "Polygon") {
        coordsArr = geom.getCoordinates()[0] || [];
      }
      if (!Array.isArray(coordsArr[0])) coordsArr = [coordsArr];
      coordsArr.forEach((coord) => {
        if (Array.isArray(coord) && typeof coord[0] === "number") {
          vertexSource.addFeature(new Feature(new Point(coord)));
        }
      });
    }

    // selectedFeatureId가 바뀔 때마다 꼭짓점 마커 동기화
    useEffect(() => {
      updateVertexMarkers();
    }, [selectedFeatureId]);

    // polygonSource Feature 변경 시 vertex 동기화 (polygonSource 준비 후에만)
    useEffect(() => {
      const polygonSource = polygonSourceRef.current;
      if (!polygonSource) return;
      const update = () => updateVertexMarkers();
      polygonSource.on("addfeature", update);
      polygonSource.on("changefeature", update);
      polygonSource.on("removefeature", update);
      // 최초 1회 동기화
      updateVertexMarkers();
      return () => {
        polygonSource.un("addfeature", update);
        polygonSource.un("changefeature", update);
        polygonSource.un("removefeature", update);
      };
    }, []);

    // 임무 탭에서 transform 인터랙션 추가 (스케일, 회전, 이동)
    useEffect(() => {
      if (currentTab !== 2) return;
      const map = mapRef.current;
      const polygonSource = polygonSourceRef.current;
      if (!map || !polygonSource) return;

      // transform 인터랙션 생성
      const transform = new TransformInteraction({
        enableRotation: true, // 회전 활성화
        enableScale: true, // 크기 조절 활성화
        stretchy: false, // 비율 유지
        source: polygonSource,
        translate: true, // 이동 활성화
        scale: true, // 크기 조절 활성화
        rotate: true, // 회전 활성화
        keepAspectRatio: false, // 비율 유지 여부
        condition: shiftKeyOnly, // Shift 키를 누른 상태에서만 활성화
      });

      // 변환 완료 이벤트
      transform.on("transformend", function (e) {
        // 변환된 feature 가져오기
        const feature = e.feature;
        const objectId = feature.get("objectId");
        const geometry = feature.getGeometry();

        if (typeof handleFeatureMoved === "function" && objectId) {
          // 그리드 업데이트 요청
          handleFeatureMoved({
            objectId: objectId,
            geometry: {
              type: geometry.getType(),
              coordinates: geometry.getCoordinates(),
              radius:
                geometry.getType() === "Circle" ? geometry.getRadius() : null,
            },
            properties: feature.get("properties") || {},
          });
        }
      });

      // 맵에 인터랙션 추가
      map.addInteraction(transform);

      // cleanup
      return () => {
        map.removeInteraction(transform);
      };
    }, [currentTab, handleFeatureMoved]);

    // Shift 키로만 vertex 편집 가능하게 (임무탭에서만)
    useEffect(() => {
      if (currentTab !== 2) return;
      const map = mapRef.current;
      const polygonSource = polygonSourceRef.current;
      if (!map || !polygonSource) return;

      const handleKeyDown = (e) => {
        if (e.key === "Shift" && !modifyInteractionRef.current) {
          const modify = new Modify({
            source: polygonSource,
            style: new Style({
              image: new Circle({
                radius: 7,
                fill: new Fill({ color: "#1976d2" }),
                stroke: new Stroke({ color: "#1976d2", width: 2 }),
              }),
            }),
          });

          // Feature 수정 완료 시 이벤트 핸들러 추가
          modify.on("modifyend", (event) => {
            // 수정된 features
            const features = event.features.getArray();
            features.forEach((feature) => {
              // 수정된 feature의 objectId와 geometry 정보 가져오기
              const objectId = feature.get("objectId");
              const geometry = feature.getGeometry();
              if (!objectId || !geometry) return;

              // 그리드에 업데이트할 데이터 생성
              const updatedFeature = {
                objectId: objectId,
                geometry: {
                  type: geometry.getType(),
                  coordinates: geometry.getCoordinates(),
                  radius:
                    geometry.getType() === "Circle"
                      ? geometry.getRadius()
                      : null,
                },
                properties: feature.get("properties") || {},
              };

              // 그리드 업데이트 요청
              if (typeof handleFeatureMoved === "function") {
                handleFeatureMoved(updatedFeature);
              }
            });
          });

          map.addInteraction(modify);
          modifyInteractionRef.current = modify;
        }
      };
      const handleKeyUp = (e) => {
        if (e.key === "Shift" && modifyInteractionRef.current) {
          map.removeInteraction(modifyInteractionRef.current);
          modifyInteractionRef.current = null;
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
        if (modifyInteractionRef.current) {
          map.removeInteraction(modifyInteractionRef.current);
          modifyInteractionRef.current = null;
        }
      };
    }, [currentTab, handleFeatureMoved]);

    return (
      <div
        className="gis-map-wrap"
        style={{ width: "100%", height: "100%", position: "relative" }}
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
        {/* 임무탭: MissionButton + 모달 + MissionObjects */}
        {currentTab === 2 && (
          <>
            <div
              style={{ position: "absolute", top: 16, left: 16, zIndex: 200 }}
            >
              <MissionButton onClick={handleMissionButtonClick} />
            </div>
            <Dialog open={missionModalOpen} onClose={handleMissionModalClose}>
              <DialogTitle>드로우 타입 선택</DialogTitle>
              <DialogContent>
                <RadioGroup value={drawType} onChange={handleDrawTypeChange}>
                  <FormControlLabel
                    value="Point"
                    control={<Radio />}
                    label="점"
                  />
                  <FormControlLabel
                    value="LineString"
                    control={<Radio />}
                    label="선"
                  />
                  <FormControlLabel
                    value="Circle"
                    control={<Radio />}
                    label="원"
                  />
                  <FormControlLabel
                    value="Polygon"
                    control={<Radio />}
                    label="면"
                  />
                </RadioGroup>
              </DialogContent>
              <DialogActions>
                <Button onClick={handleMissionModalClose}>취소</Button>
                <Button onClick={handleMissionModalConfirm} variant="contained">
                  확인
                </Button>
              </DialogActions>
            </Dialog>
            <MissionObjects
              map={mapRef.current}
              isActive={currentTab === 2}
              missionData={missionData}
              polygonSource={polygonSourceRef.current}
            />
          </>
        )}
        {/* TODO: 다른 탭의 버튼들 추가 */}
      </div>
    );
  }
);

export default MapTest;
