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
import { Geometry, Point as OlPoint } from "ol/geom";
import {
  createGcpPointsLayer,
  createPointFeature,
} from "./mapObjects/GCPObjects";
import { createLandingPointsLayer } from "./mapObjects/LandingObjects";
import MissionObjects from "./mapObjects/MissionObjects";
import AddButton from "../../components/buttons/AddButton";
import DeleteButton from "../../components/buttons/DeleteButton";
import MoveButton from "../../components/buttons/MoveButton";
import { Select, Translate } from "ol/interaction";
import {
  click,
  shiftKeyOnly,
  platformModifierKeyOnly,
} from "ol/events/condition";
import "ol/ol.css";
import { Style, Circle, Fill, Stroke, Text, Icon } from "ol/style";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Draw from "ol/interaction/Draw";
import Snap from "ol/interaction/Snap";
import MissionButton from "../../components/buttons/MissionButton";
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
import { Collection } from "ol";
import { FeatureLike } from "ol/Feature";
import { Coordinate } from "ol/coordinate";
import { BaseEvent } from "ol/events";

type DrawType = 'Point' | 'LineString' | 'Polygon' | 'Circle';

interface PointData {
  objectId: number;
  name: string;
  lat: number;
  lon: number;
  rel_alt?: number;
  note?: string;
}

interface MissionData {
  features: Array<{
    geometry: {
      type: DrawType;
      coordinates: number[];
      radius?: number;
    };
    properties?: Record<string, any>;
    objectId?: string;
  }>;
}

interface MapProps {
  gcpData?: PointData[];
  modifiedData?: PointData[];
  handleMapPointAdded?: (point: PointData) => void;
  handleFeatureMoved?: (feature: Feature<Geometry>) => void;
  handleFeatureDeleted?: (objectId: number) => void;
  currentTab: number;
  onFeatureSelect?: (objectId: number) => void;
  onMissionFeatureAdded?: (feature: Feature<Geometry>) => void;
  getNextMissionObjectId?: () => number;
}

interface MapRef {
  addPoint: (row: PointData) => void;
  updateFeature: (row: PointData) => void;
  deleteFeature: (objectId: number) => void;
  deleteMissionFeature: (objectId: string | number) => boolean;
  highlightFeatureAndPan: (objectId: string | number) => void;
  panToFeature: (feature: Feature<Geometry>) => void;
}

interface ToggleModeHandler {
  (isActive: boolean): void;
  reset?: (value: boolean) => void;
}

interface LayerRef {
  layer: VectorLayer<VectorSource>;
  source: VectorSource;
}

interface FeatureProperties {
  objectId: number;
  name: string;
  lat: string;
  lon: string;
  rel_alt?: string;
  note?: string;
}

interface GCPGridRef {
  clearSelection: () => void;
}

interface FeatureWithObjectId extends Feature<Geometry> {
  objectId: string | number;
  properties: Record<string, any>;
  ol_uid: string | number;
  uid: string | number;
  get(key: string): any;
  set(key: string, value: any): void;
}

interface StyleWithText extends Style {
  getText(): Text;
}

interface GeometryWithCoordinates extends Geometry {
  getCoordinates(): number[][];
  setCoordinates(coordinates: number[][]): void;
}

interface CircleGeometry extends Geometry {
  getCenter(): number[];
  getRadius(): number;
  setCenter(center: number[]): void;
  setRadius(radius: number): void;
}

interface GeoJSONFeature {
  objectId: string | number;
  type: string;
  properties: {
    name: string;
    notes: string;
  };
  geometry: {
    type: string;
    coordinates: number[];
    radius: number | null;
  };
}

interface MissionFeatureAdded extends Feature<Geometry> {
  objectId: string | number;
  properties: Record<string, any>;
  type: string;
  geometry: GeometryWithCoordinates | CircleGeometry;
  get(key: string): any;
  set(key: string, value: any): void;
}

interface FeatureWithProperties extends Feature<Geometry> {
  get(key: string): any;
  set(key: string, value: any): void;
  objectId: string;
}

interface GeometryWithType extends Geometry {
  type: string;
}

// 상수 정의
const MAP_CONFIG = {
  INITIAL_CENTER: [126.978, 37.5665] as Coordinate, // 서울시청
  INITIAL_ZOOM: 15,
  MIN_ZOOM: 7,
  MAX_ZOOM: 20,
  PROJECTION: "EPSG:3857",
  TILE_URL: "http://xdworld.vworld.kr:8080/2d/Base/202002/{z}/{x}/{y}.png",
} as const;

// 포인트 스타일 정의
const POINT_STYLE = {
  SELECTED: new Style({
    image: new Circle({
      radius: 8,
      fill: new Fill({ color: "blue" }),
      stroke: new Stroke({ color: "orange", width: 3 }),
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
} as const;

interface MapEvent {
  coordinate: number[];
  originalEvent: MouseEvent;
}

interface SelectEvent {
  selected: Feature<Geometry>[];
  deselected: Feature<Geometry>[];
}

interface TranslateEvent {
  features: Collection<Feature<Geometry>>;
}

// 타입 정의 추가
interface MapBrowserEvent<T = any> extends MapEvent {
  pixel: number[];
  pixel_: number[];
  coordinate_: number[];
  dragging: boolean;
  activePointers: any[];
  map: Map<any, any>;
  frameState: any;
  propagationStopped: boolean;
  defaultPrevented: boolean;
  type: string;
  target: any;
  preventDefault(): void;
  stopPropagation(): void;
}

// Transform 인터랙션 관련 타입 정의
interface TransformEvent {
  feature: Feature<Geometry>;
  type: string;
}

interface TransformEndEvent extends TransformEvent {
  geometry: Geometry;
}

interface TransformSelectEvent extends TransformEvent {
  selected: boolean;
}

// 이벤트 타입 정의
type MapEventType = 
  | "change" 
  | "error" 
  | "propertychange" 
  | "postrender" 
  | "change:layergroup" 
  | "change:size" 
  | "change:target" 
  | "change:view" 
  | "singleclick" 
  | "click" 
  | "dblclick" 
  | "pointerdrag" 
  | "rendercomplete"
  | "postcompose"
  | "precompose"
  | "loadend"
  | "loadstart"
  | "moveend";

type TransformEventType = 
  | "transformend" 
  | "select" 
  | "translatestart" 
  | "translateend" 
  | "rotateend" 
  | "scaleend";

type DrawEventType = 
  | "propertychange" 
  | "change:active" 
  | "drawabort" 
  | "drawend" 
  | "drawstart"
  | MapEventType;

const MapTest = forwardRef<MapRef, MapProps>(
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
      getNextMissionObjectId,
    },
    ref
  ): React.ReactElement => {
    const mapContent = useRef<HTMLDivElement>(null);
    const mapRef = useRef<OlMap | null>(null);
    const gcpLayerRef = useRef<LayerRef | null>(null);
    const landingLayerRef = useRef<LayerRef | null>(null);
    const missionLayerRef = useRef<LayerRef | null>(null);
    const pointFeaturesRef = useRef<Feature<Geometry>[]>([]);
    const nextObjectIdRef = useRef<number>(1);
    const isAddingPointRef = useRef<boolean>(false);
    const isDeletingPointRef = useRef<boolean>(false);
    const isMovingPointRef = useRef<boolean>(false);
    const selectInteractionRef = useRef<Select | null>(null);
    const translateInteractionRef = useRef<Translate | null>(null);
    const gcpGridRef = useRef<GCPGridRef | null>(null);
    const polygonLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
    const polygonSourceRef = useRef<VectorSource | null>(null);
    const drawInteractionRef = useRef<Draw | null>(null);
    const snapInteractionRef = useRef<Snap | null>(null);
    const vertexLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
    const vertexSourceRef = useRef<VectorSource | null>(null);
    const modifyInteractionRef = useRef<Modify | null>(null);
    const [missionModalOpen, setMissionModalOpen] = useState<boolean>(false);
    const [drawType, setDrawType] = useState<DrawType>("Polygon");
    const [selectedFeatureId, setSelectedFeatureId] = useState<number | null>(null);
    const [missionData, setMissionData] = useState<MissionData>({ features: [] });
    const [nums, setNums] = useState<number>(1);

    const handleToggleAddingMode = useCallback<ToggleModeHandler>((isActive) => {
      isAddingPointRef.current = isActive;
    }, []);

    const handleToggleDeletingMode = useCallback<ToggleModeHandler>((isActive) => {
      isDeletingPointRef.current = isActive;
    }, []);

    const handleToggleMovingMode = useCallback<ToggleModeHandler>((isActive) => {
      isMovingPointRef.current = isActive;
    }, []);

    const handleMissionButtonClick = useCallback(() => {
      setMissionModalOpen(true);
    }, []);

    const startMissionDraw = useCallback(() => {
      const map = mapRef.current;
      if (!map) return;
      const polygonSource = polygonSourceRef.current;
      if (!polygonSource) return;

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
      draw.on(["drawend"], (e: BaseEvent) => {
        const event = e as unknown as { feature: MissionFeatureAdded };
        setTimeout(() => {
          map.removeInteraction(draw);
          map.removeInteraction(snap);
        }, 100);

        // 기존 콘솔 출력
        const feature = event.feature;
        const geometry = feature.getGeometry() as GeometryWithCoordinates;
        if (!geometry) return;

        console.log("missionData", missionData);

        // 다음 objectId 계산
        const nextId = getNextMissionObjectId ? getNextMissionObjectId() : 1;

        // 임무 그리드에 행 추가 이벤트 발생 (부모 컴포넌트에서 처리)
        if (typeof onMissionFeatureAdded === "function" && currentTab === 2) {
          const missionFeature: MissionFeatureAdded = {
            objectId: "",
            type: geometry.getType(),
            properties: {
              name: "",
              notes: "",
            },
            geometry: {
              type: geometry.getType(),
              coordinates:
                geometry.getType() === "Circle"
                  ? (geometry as CircleGeometry).getCenter()
                  : geometry.getCoordinates(),
              radius:
                geometry.getType() === "Circle" ? (geometry as CircleGeometry).getRadius() : null,
            },
          };
          onMissionFeatureAdded(missionFeature);
        }

        // GeoJSON 객체로 변환
        const geojsonFormat = new GeoJSON();
        const geojsonObj = geojsonFormat.writeFeatureObject(feature) as GeoJSONFeature;

        // GeoJSON 객체 수정
        geojsonObj.objectId = nextId;
        geojsonObj.properties = {
          name: "",
          notes: "",
        };

        // 원본 feature에도 같은 속성 설정
        feature.set("objectId", nextId);
        feature.set("name", "");
        feature.set("notes", "");
      });
    }, [currentTab, drawType, getNextMissionObjectId, missionData, onMissionFeatureAdded]);

    const handleMissionModalClose = useCallback(() => {
      setMissionModalOpen(false);
    }, []);

    const handleDrawTypeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setDrawType(e.target.value as DrawType);
    }, []);

    const handleMissionModalConfirm = useCallback(() => {
      setMissionModalOpen(false);
      startMissionDraw();
    }, [startMissionDraw]);

    // missionData.json fetch면
    useEffect(() => {
      fetch("/jsondatas/missionData.json")
        .then((res) => res.json())
        .then((data: MissionData) => {
          setMissionData(data);
        })
        .catch((err) => {
          console.error("missionData.json load error:", err);
        });
    }, []);

    // addPoint, updateFeature 메서드 구현
    useImperativeHandle(ref, () => ({
      addPoint: (row: PointData) => {
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
      updateFeature: (row: PointData) => {
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
            let style = feature.getStyle() as StyleWithText;
            if (!style) {
              style = POINT_STYLE.SELECTED.clone() as StyleWithText;
            }
            const text = style.getText();
            if (text) {
              text.setText(row.name);
            }
            feature.setStyle(style);
            // properties도 갱신
            const props = feature.get("properties");
            if (props) {
              props.name = row.name;
              feature.set("properties", { ...props });
              feature.changed();
            }
          }
          // 위치 변경
          if (
            row.lat !== undefined &&
            row.lon !== undefined &&
            !isNaN(Number(row.lat)) &&
            !isNaN(Number(row.lon))
          ) {
            const coords = fromLonLat([Number(row.lon), Number(row.lat)]);
            const geometry = feature.getGeometry() as GeometryWithCoordinates;
            if (geometry) {
              geometry.setCoordinates(coords);
            }
          }
        }
      },
      deleteFeature: (objectId: number) => {
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
      deleteMissionFeature: (objectId: string | number) => {
        if (!polygonSourceRef.current || !objectId) return false;

        console.log("미션 피처 삭제 요청:", objectId);

        // objectId로 피처 찾기
        const features = polygonSourceRef.current.getFeatures();
        const feature = features.find((f) => {
          // 문자열 비교를 위해 String() 변환
          const fid = f.get("objectId");
          return String(fid) === String(objectId);
        }) as FeatureWithObjectId;

        // 피처가 있으면 삭제
        if (feature) {
          console.log("미션 피처 찾음, 삭제 실행:", feature);
          polygonSourceRef.current.removeFeature(feature);

          // 선택된 피처가 삭제된 경우 선택 제거
          if (
            selectedFeatureId &&
            (feature.ol_uid === selectedFeatureId ||
              feature.getId() === selectedFeatureId ||
              feature.uid === selectedFeatureId)
          ) {
            setSelectedFeatureId(null);
          }

          // 성공적으로 삭제됨
          return true;
        }

        // 피처를 찾지 못함
        console.log("미션 피처를 찾을 수 없음:", objectId);
        return false;
      },
      highlightFeatureAndPan: (objectId: string | number) => {
        if (!objectId) return;

        // 임무탭이면 polygonSource에서 찾기
        if (currentTab === 2 && polygonSourceRef.current) {
          const features = polygonSourceRef.current.getFeatures();
          const feature = features.find((f) => {
            const fid = f.get("objectId");
            return String(fid) === String(objectId);
          });
          if (feature) {
            const extent = feature.getGeometry()?.getExtent();
            if (extent) {
              mapRef.current?.getView().fit(extent, {
                duration: 1000,
                padding: [50, 50, 50, 50],
              });
            }
          }
        }
      },
      panToFeature: (feature: Feature<Geometry>) => {
        if (!mapRef.current || !feature) return;
        const geometry = feature.getGeometry();
        if (geometry) {
          const extent = geometry.getExtent();
          mapRef.current.getView().fit(extent, {
            duration: 1000,
            padding: [50, 50, 50, 50],
          });
        }
      },
    }));

    useEffect(() => {
      if (!mapContent.current) return;

      const { vectorLayer: gcpLayer, vectorSource: gcpSource } = createGcpPointsLayer();
      gcpLayerRef.current = { layer: gcpLayer, source: gcpSource };

      const { vectorLayer: landingLayer, vectorSource: landingSource } = createLandingPointsLayer();
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
          projection: getProjection(MAP_CONFIG.PROJECTION) || undefined,
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
        style: (feature: FeatureLike) => {
          const style = POINT_STYLE.SELECTED.clone();
          const text = style.getText();
          if (text) {
            text.setText(feature.get("properties")?.name || "");
          }
          return style;
        },
      });

      const translate = new Translate({
        features: select.getFeatures(),
      });

      translate.on("translateend", function (event: TranslateEvent) {
        const features = event.features.getArray();
        features.forEach((feature: Feature<Geometry>) => {
          const geometry = feature.getGeometry();
          if (!geometry) return;
          
          const coords = (geometry as OlPoint).getCoordinates();
          const [lon, lat] = toLonLat(coords);

          const props = feature.get("properties");
          if (props) {
            props.lon = String(lon);
            props.lat = String(lat);
            props.rel_alt = String(props.rel_alt ?? "");
            feature.set("properties", { ...props });
            feature.changed();

            if (typeof handleFeatureMoved === "function") {
              handleFeatureMoved({
                objectId: props.objectId,
                lat: String(props.lat),
                lon: String(props.lon),
                rel_alt: String(props.rel_alt ?? ""),
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

      const handleMapClick = (event: MapEvent) => {
        if (isMovingPointRef.current) return;

        if (isAddingPointRef.current) {
          const clickCoord = event.coordinate;
          const [lon, lat] = toLonLat(clickCoord);

          const newPoint: PointData = {
            objectId: nextObjectIdRef.current,
            name: `새 포인트`,
            lat: parseFloat(String(lat)),
            lon: parseFloat(String(lon)),
            rel_alt: 0,
            note: "",
          };

          // 추가: 동일한 objectId를 가진 Feature가 이미 존재하는지 확인
          const { source } = gcpLayerRef.current!;
          const exists = source.getFeatures().some((f) => {
            const props = f.get("properties");
            return props && props.objectId === newPoint.objectId;
          });

          if (exists) {
            // 중복 ID면 다음 ID 사용
            nextObjectIdRef.current++;
            newPoint.objectId = nextObjectIdRef.current;
          }

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
          let closestFeature: Feature<Geometry> | null = null;

          map.forEachFeatureAtPixel(clickPixel, (feature: FeatureLike) => {
            closestFeature = feature as Feature<Geometry>;
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

      select.on("select", (e: SelectEvent) => {
        if (e.selected && e.selected.length > 0) {
          const feature = e.selected[0] as FeatureWithProperties;
          const objectId = feature.get("properties")?.objectId;
          if (typeof onFeatureSelect === "function" && objectId) {
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
        onFeatureSelect(null as unknown as number);
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

      if (currentTab === 2) {
        if (polygonLayer) map.addLayer(polygonLayer);
        if (gcpLayer) map.addLayer(gcpLayer);
        if (landingLayer) map.addLayer(landingLayer);
      } else {
        if (polygonLayer) map.removeLayer(polygonLayer);
        if (gcpLayer) map.removeLayer(gcpLayer);
        if (landingLayer) map.removeLayer(landingLayer);
      }
    }, [currentTab]);

    // Feature 클릭 시 선택된 Feature만 꼭짓점 마커 표시
    useEffect(() => {
      const polygonSource = polygonSourceRef.current;
      const map = mapRef.current;
      if (!polygonSource || !map) return;

      const handleFeatureClick = (evt: MapBrowserEvent) => {
        // Ctrl 키(맥에서는 Command)가 눌려있으면 TransformInteraction이 처리하므로 무시
        if (platformModifierKeyOnly(evt)) {
          console.log("Ctrl/Command+클릭: TransformInteraction에 위임");
          return;
        }

        // Shift 키가 눌려있으면 꼭짓점 편집(Modify Interaction)이 처리하므로 무시
        if (evt.originalEvent.shiftKey) {
          console.log("Shift+클릭: 꼭짓점 편집 모드에 위임");
          return;
        }

        // 임무 탭일 때 polygonSource에서 Feature 찾기
        if (currentTab === 2) {
          map.forEachFeatureAtPixel(evt.pixel, (feature: FeatureLike) => {
            if (polygonSource.getFeatures().includes(feature as Feature<Geometry>)) {
              // feature의 objectId 가져오기
              const objectId = feature.get("objectId");

              // feature ID 설정 (꼭짓점 마커용)
              const featureWithProps = feature as FeatureWithObjectId;
              const featureId = featureWithProps.ol_uid || feature.getId() || featureWithProps.uid;
              
              if (featureId && Number(featureId) === selectedFeatureId) {
                setSelectedFeatureId(Number(featureId));
              }

              // 선택된 Feature 시각적으로 강조
              console.log("Feature 일반 선택:", feature);

              // 그리드 행 선택 요청
              if (typeof onFeatureSelect === "function" && objectId) {
                onFeatureSelect(objectId);
              }

              return true;
            }
            return false;
          });
        } else {
          // GCP/이착륙 탭일 때 - 기존 레이어에서 Feature 찾기
          let selectedObjectId: number | null = null;
          // 클릭된 좌표에서 Feature 찾기
          map.forEachFeatureAtPixel(evt.pixel, (feature: FeatureLike) => {
            // properties에서 objectId 얻기
            const props = feature.get("properties");
            if (props && props.objectId) {
              selectedObjectId = props.objectId;
              return true;
            }
            return false;
          });

          // objectId가 있으면 onFeatureSelect 호출
          if (selectedObjectId && typeof onFeatureSelect === "function") {
            onFeatureSelect(selectedObjectId);
          }
        }
      };

      map.on("click", handleFeatureClick);
      return () => {
        map.un("click", handleFeatureClick);
      };
    }, [currentTab, onFeatureSelect]);

    // 꼭짓점 마커 동기화 함수 (선택된 Feature만, 원은 제외)
    function updateVertexMarkers(): void {
      const vertexSource = vertexSourceRef.current;
      const polygonSource = polygonSourceRef.current;
      if (!vertexSource || !polygonSource) return;
      vertexSource.clear();
      if (!selectedFeatureId) return;
      const feature = polygonSource
        .getFeatures()
        .find((f) => {
          const featureWithProps = f as FeatureWithObjectId;
          const featureId = featureWithProps.ol_uid || f.getId() || featureWithProps.uid;
          return Number(featureId) === selectedFeatureId;
        });
      if (!feature) return;
      const geom = feature.getGeometry();
      if (!geom) return;
      let coordsArr: number[][] = [];
      if (geom.getType() === "Point") {
        coordsArr = [(geom as OlPoint).getCoordinates()];
      } else if (geom.getType() === "LineString") {
        coordsArr = (geom as GeometryWithCoordinates).getCoordinates();
      } else if (geom.getType() === "Polygon") {
        coordsArr = (geom as GeometryWithCoordinates).getCoordinates()[0] || [];
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

    // 임무 탭에서 transform 인터랙션 추가 (스케일, 회전, 이동)
    useEffect(() => {
      if (currentTab !== 2) return;
      const map = mapRef.current;
      const polygonSource = polygonSourceRef.current;
      if (!map || !polygonSource) return;

      try {
        // transform 인터랙션 생성
        const transform = new TransformInteraction({
          enableRotation: true,
          enableScale: true,
          stretchy: false,
          source: polygonSource,
          translate: true,
          scale: true,
          rotate: true,
          keepAspectRatio: false,
          condition: (e: MapBrowserEvent<any>) => {
            return platformModifierKeyOnly(e);
          },
        });

        // 디버깅을 위해 전역 객체에 transform 참조 추가
        (window as any).debugTransform = transform;

        // 변환 완료 이벤트에서만 로그 출력
        transform.on("transformend" as TransformEventType, (e: TransformEndEvent) => {
          console.log("TRANSFORM END 이벤트 발생!");
          const feature = e.feature;
          const geometry = feature.getGeometry();
          if (!geometry) return;

          console.log("=== Transform 완료 후 Geometry 정보 ===");
          console.log("Geometry:", geometry);
          console.log("Type:", geometry.getType());

          // 타입별로 필요한 정보만 출력
          if (geometry.getType() === "Circle") {
            const circleGeom = geometry as CircleGeometry;
            console.log("Center:", circleGeom.getCenter());
            console.log("Radius:", circleGeom.getRadius());
          } else {
            const geomWithCoords = geometry as GeometryWithCoordinates;
            console.log("Coordinates:", geomWithCoords.getCoordinates());
          }

          const objectId = feature.get("objectId");

          if (typeof handleFeatureMoved === "function" && objectId) {
            console.log("handleFeatureMoved 호출 시도");
            const updateData = {
              objectId: objectId,
              geometry: {
                type: (geometry as GeometryWithType).getType(),
                coordinates:
                  geometry.getType() === "Circle"
                    ? [(geometry as unknown as CircleGeometry).getCenter()]
                    : (geometry as GeometryWithCoordinates).getCoordinates(),
                radius:
                  geometry.getType() === "Circle" 
                    ? (geometry as unknown as CircleGeometry).getRadius() 
                    : null,
              },
              properties: feature.get("properties") || {},
            };
            console.log("전송 데이터:", updateData);
            handleFeatureMoved(updateData);
            console.log("handleFeatureMoved 호출 완료");
          } else {
            console.log("handleFeatureMoved 함수 없음 또는 objectId 없음:", {
              handleFeatureMoved,
              objectId,
            });
          }
        });

        // Feature 선택 시 로깅
        transform.on("select" as TransformEventType, (e: TransformSelectEvent) => {
          console.log("Transform - Ctrl/Command+선택됨:", e.feature);
          if (e.feature) {
            const geom = e.feature.getGeometry();
            if (!geom) return;
            console.log("선택된 Feature Geometry:", geom);
            console.log("Ctrl/Command 선택 - Transform 모드 활성화");
          }
        });

        transform.on("translatestart" as TransformEventType, (e: TransformEvent) => {
          console.log("TransformInteraction: translatestart 이벤트 발생");
          const geom = e.feature.getGeometry();
          if (!geom) return;
          console.log("이동 시작 Geometry:", geom);
          if (geom.getType() === "Circle") {
            const circleGeom = geom as CircleGeometry;
            console.log("중심점:", circleGeom.getCenter());
          } else {
            const geomWithCoords = geom as GeometryWithCoordinates;
            console.log("좌표:", geomWithCoords.getCoordinates());
          }
        });

        transform.on("translateend" as TransformEventType, (e: TransformEndEvent) => {
          console.log("TransformInteraction: translateend 이벤트 발생");
          const feature = e.feature;
          const geom = feature.getGeometry();
          if (!geom) return;
          console.log("이동 완료 Geometry:", geom);
          if (geom.getType() === "Circle") {
            const circleGeom = geom as CircleGeometry;
            console.log("중심점:", circleGeom.getCenter());
          } else {
            const geomWithCoords = geom as GeometryWithCoordinates;
            console.log("좌표:", geomWithCoords.getCoordinates());
          }

          // 그리드에 업데이트
          const objectId = feature.get("objectId");
          if (typeof handleFeatureMoved === "function" && objectId) {
            handleFeatureMoved({
              objectId: objectId,
              geometry: {
                type: geom.getType(),
                coordinates:
                  geom.getType() === "Circle"
                    ? [(geom as CircleGeometry).getCenter()]
                    : (geom as GeometryWithCoordinates).getCoordinates(),
                radius: geom.getType() === "Circle" 
                  ? (geom as CircleGeometry).getRadius() 
                  : null,
              },
              properties: feature.get("properties") || {},
            });
          }
        });

        transform.on("rotateend" as TransformEventType, (e: TransformEndEvent) => {
          console.log("TransformInteraction: rotateend 이벤트 발생");
          const feature = e.feature;
          const geom = feature.getGeometry();
          if (!geom) return;
          console.log("회전 완료 Geometry:", geom);
          if (geom.getType() === "Circle") {
            const circleGeom = geom as CircleGeometry;
            console.log("중심점:", circleGeom.getCenter());
          } else {
            const geomWithCoords = geom as GeometryWithCoordinates;
            console.log("좌표:", geomWithCoords.getCoordinates());
          }

          // 그리드에 업데이트
          const objectId = feature.get("objectId");
          if (typeof handleFeatureMoved === "function" && objectId) {
            handleFeatureMoved({
              objectId: objectId,
              geometry: {
                type: geom.getType(),
                coordinates:
                  geom.getType() === "Circle"
                    ? [(geom as CircleGeometry).getCenter()]
                    : (geom as GeometryWithCoordinates).getCoordinates(),
                radius: geom.getType() === "Circle" 
                  ? (geom as CircleGeometry).getRadius() 
                  : null,
              },
              properties: feature.get("properties") || {},
            });
          }
        });

        transform.on("scaleend" as TransformEventType, (e: TransformEndEvent) => {
          console.log("TransformInteraction: scaleend 이벤트 발생");
          const feature = e.feature;
          const geom = feature.getGeometry();
          if (!geom) return;
          console.log("크기 조절 완료 Geometry:", geom);
          if (geom.getType() === "Circle") {
            const circleGeom = geom as CircleGeometry;
            console.log("중심점:", circleGeom.getCenter());
            console.log("반경:", circleGeom.getRadius());
          } else {
            const geomWithCoords = geom as GeometryWithCoordinates;
            console.log("좌표:", geomWithCoords.getCoordinates());
          }

          // 그리드에 업데이트
          const objectId = feature.get("objectId");
          if (typeof handleFeatureMoved === "function" && objectId) {
            handleFeatureMoved({
              objectId: objectId,
              geometry: {
                type: geom.getType(),
                coordinates:
                  geom.getType() === "Circle"
                    ? [(geom as CircleGeometry).getCenter()]
                    : (geom as GeometryWithCoordinates).getCoordinates(),
                radius: geom.getType() === "Circle" 
                  ? (geom as CircleGeometry).getRadius() 
                  : null,
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
          delete (window as any).debugTransform;
        };
      } catch (err) {
        console.error("Transform 인터랙션 초기화 중 오류:", err);
      }
    }, [currentTab, handleFeatureMoved]);

    // Shift 키로만 vertex 편집 가능하게 (임무탭에서만)
    useEffect(() => {
      if (currentTab !== 2) return;
      const map = mapRef.current;
      const polygonSource = polygonSourceRef.current;
      if (!map || !polygonSource) return;

      const handleKeyDown = (e: KeyboardEvent) => {
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
          modify.on("modifyend", (event: { features: Collection<Feature<Geometry>> }) => {
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
                  coordinates:
                    geometry.getType() === "Circle"
                      ? (geometry as CircleGeometry).getCenter()
                      : (geometry as GeometryWithCoordinates).getCoordinates() as number[][],
                  radius:
                    geometry.getType() === "Circle"
                      ? (geometry as CircleGeometry).getRadius()
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

          // 맵에 인터랙션 추가
          map.addInteraction(modify);
          modifyInteractionRef.current = modify;
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === "Shift" && modifyInteractionRef.current) {
          map.removeInteraction(modifyInteractionRef.current);
          modifyInteractionRef.current = null;
        }
      };

      // 키보드 이벤트 리스너 등록
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      // cleanup
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
            {mapRef.current && polygonSourceRef.current && (
              <MissionObjects
                map={mapRef.current as OlMap}
                isActive={currentTab === 2}
                missionData={missionData}
                polygonSource={polygonSourceRef.current as VectorSource}
              />
            )}
          </>
        )}
      </div>
    );
  }
);

export default MapTest; 