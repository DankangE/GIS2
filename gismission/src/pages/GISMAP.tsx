import React, { useState, useEffect, useRef } from "react";
import { Tabs, Tab, Box } from "@mui/material";
import MapTest from "../components/maps/Map";
import GCPGrid from "../components/grids/GCPGrid";
import LandingGrid from "../components/grids/LandingGrid";
import MissionGrid from "../components/grids/MissionGrid";
import { Feature } from "ol";
import { Geometry } from "ol/geom";

// 타입 정의
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
      type: string;
      coordinates: number[];
      radius?: number;
    };
    properties?: Record<string, any>;
    objectId?: string;
  }>;
}

interface GridRef {
  clearAllSelectedBg: () => void;
  addRowFromMap: (row: PointData) => void;
  updateRowFromMap: (row: PointData) => void;
}

interface MapRef {
  refreshMap: () => void;
  addPoint: (row: PointData) => void;
  updateFeature: (row: PointData) => void;
  deleteFeature: (objectId: number) => void;
  deleteMissionFeature: (objectId: string | number) => boolean;
  highlightFeatureAndPan: (objectId: string | number) => void;
}

const GISMAP: React.FC = () => {
  // 현재 선택된 탭 상태
  const [currentTab, setCurrentTab] = useState<number>(0);

  // 각 탭별 데이터 상태
  const [gcpData, setGcpData] = useState<PointData[]>([]);
  const [landingData, setLandingData] = useState<PointData[]>([]);
  const [missionData, setMissionData] = useState<MissionData>({ features: [] });

  // 수정된 데이터 상태
  const [modifiedData, setModifiedData] = useState<PointData[]>([]);

  // refs
  const mapRef = useRef<MapRef>(null);
  const gridRef = useRef<GridRef>(null);

  useEffect(() => {
    if (gridRef.current) {
      console.log("gridRef.current.clientHeight", gridRef.current.clientHeight);
    }
  }, []);

  // 초기 데이터 로딩
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const gcpResponse = await fetch("/jsondatas/gcpData.json");
        const gcpData = await gcpResponse.json();
        setGcpData(gcpData);
      } catch (error) {
        console.error("초기 GCP 데이터 로드 실패:", error);
      }
    };
    loadInitialData();
  }, []);

  // 탭 변경 핸들러
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
    // 탭 변경 시 수정된 데이터 초기화
    setModifiedData([]);
    // 탭 변경 시 그리드의 선택된 행 배경색 초기화
    if (
      gridRef.current &&
      typeof gridRef.current.clearAllSelectedBg === "function"
    ) {
      gridRef.current.clearAllSelectedBg();
    }

    // 탭 변경 시 데이터 재조회하여 맵 리렌더링
    const loadData = async () => {
      try {
        // 현재 선택된 탭에 따라 데이터 로드
        if (newValue === 0) {
          // GCP 데이터 로드
          const gcpResponse = await fetch("/jsondatas/gcpData.json");
          const gcpData = await gcpResponse.json();
          setGcpData(gcpData);
        } else if (newValue === 1) {
          // 이착륙 데이터 로드
          const landingResponse = await fetch("/jsondatas/landingData.json");
          const landingData = await landingResponse.json();
          setLandingData(landingData);
        } else if (newValue === 2) {
          // 임무 데이터 로드
          const missionResponse = await fetch("/jsondatas/missionData.json");
          const missionData = await missionResponse.json();
          setMissionData(missionData);
        }

        // 맵 리프레시
        if (mapRef.current && typeof mapRef.current.refreshMap === "function") {
          mapRef.current.refreshMap();
        }
      } catch (error) {
        console.error("데이터 로드 실패:", error);
      }
    };
    loadData();
  };

  // 현재 탭에 맞는 데이터 반환
  const getCurrentData = (): PointData[] | MissionData => {
    switch (currentTab) {
      case 0:
        return gcpData;
      case 1:
        return landingData;
      case 2:
        return missionData;
      default:
        return gcpData;
    }
  };

  // 현재 탭에 맞는 그리드 컴포넌트 반환
  const getCurrentGrid = () => {
    switch (currentTab) {
      case 0:
        return (
          <GCPGrid
            ref={gridRef}
            gcpData={gcpData}
            handleGridDataChange={handleGridDataChange}
            handleGridSave={handleGridSave}
            handleRequestAddPoint={handleRequestAddPoint}
            handleRowUpdate={handleRowUpdate}
            handleDeleteRow={handleDeleteRow}
            onRowFocus={handleGridRowFocus}
          />
        );
      case 1:
        return (
          <LandingGrid
            ref={gridRef}
            landingData={landingData}
            handleGridDataChange={handleGridDataChange}
            handleGridSave={handleGridSave}
            handleRequestAddPoint={handleRequestAddPoint}
            handleRowUpdate={handleRowUpdate}
            handleDeleteRow={handleDeleteRow}
            onRowFocus={handleGridRowFocus}
          />
        );
      case 2:
        return (
          <MissionGrid
            ref={gridRef}
            missionData={missionData}
            handleGridDataChange={handleGridDataChange}
            handleGridSave={handleGridSave}
            handleRequestAddPoint={handleRequestAddPoint}
            handleRowUpdate={handleRowUpdate}
            handleDeleteRow={handleDeleteRow}
            onRowFocus={handleGridRowFocus}
          />
        );
      default:
        return null;
    }
  };

  // 그리드에서 변경된 데이터 처리
  const handleGridDataChange = (changedData: PointData[]) => {
    setModifiedData(changedData);
  };

  // 그리드에서 저장 요청 처리
  const handleGridSave = async (dataToSave: PointData[]) => {
    try {
      // 저장 후 전체 데이터 업데이트
      switch (currentTab) {
        case 0:
          // GCP 데이터 다시 로드
          const gcpResponse = await fetch("/jsondatas/gcpData.json");
          const gcpData = await gcpResponse.json();
          setGcpData(gcpData);
          break;
        case 1:
          // 이착륙 데이터 다시 로드
          const landingResponse = await fetch("/jsondatas/landingData.json");
          const landingData = await landingResponse.json();
          setLandingData(landingData);
          break;
        case 2:
          // 임무 데이터 다시 로드
          const missionResponse = await fetch("/jsondatas/missionData.json");
          const missionData = await missionResponse.json();
          setMissionData(missionData);
          // 맵 리랜더링 트릭: currentTab을 잠깐 바꿨다가 복원
          setCurrentTab(1); // 다른 탭으로 변경
          setTimeout(() => setCurrentTab(2), 0); // 다시 임무탭으로 복원
          break;
        default:
          console.warn("알 수 없는 탭 인덱스:", currentTab);
          break;
      }

      setModifiedData([]);
    } catch (error) {
      console.error("데이터 저장 후 로드 실패:", error);
    }
  };

  // 맵에서 포인트 추가 시 그리드에 행 추가
  const handleMapPointAdded = (row: PointData) => {
    if (
      gridRef.current &&
      typeof gridRef.current.addRowFromMap === "function"
    ) {
      gridRef.current.addRowFromMap(row);
    }
  };

  // 그리드에서 포인트 추가 요청 처리
  const handleRequestAddPoint = (row: PointData) => {
    if (mapRef.current && typeof mapRef.current.addPoint === "function") {
      mapRef.current.addPoint(row);
    }
  };

  // 그리드에서 행 수정 시 맵 feature 업데이트
  const handleRowUpdate = (row: PointData) => {
    if (mapRef.current && typeof mapRef.current.updateFeature === "function") {
      mapRef.current.updateFeature(row);
    }
  };

  // 그리드에서 행 삭제 시 맵의 포인트도 삭제
  const handleDeleteRow = (objectId: number) => {
    if (!mapRef.current) return;

    if (currentTab === 2) {
      // 임무 탭에서는 deleteMissionFeature 메소드 사용
      if (typeof mapRef.current.deleteMissionFeature === "function") {
        console.log("임무 기능 삭제 요청:", objectId);
        const success = mapRef.current.deleteMissionFeature(objectId);
        console.log("임무 기능 삭제 결과:", success ? "성공" : "실패");
      }
    } else {
      // GCP/이착륙 탭에서는 기존 deleteFeature 메소드 사용
      if (typeof mapRef.current.deleteFeature === "function") {
        mapRef.current.deleteFeature(objectId);
      }
    }
  };

  // 맵에서 포인트 이동 시 그리드의 행 위도/경도 갱신
  const handleFeatureMoved = (row: PointData) => {
    if (
      gridRef.current &&
      typeof gridRef.current.updateRowFromMap === "function"
    ) {
      console.log("맵에서 포인트 업데이트:", row);
      gridRef.current.updateRowFromMap(row);
    }
  };

  // 맵에서 포인트 삭제 시 그리드의 행도 삭제
  const handleFeatureDeleted = (objectId: number) => {
    if (
      gridRef.current &&
      typeof gridRef.current.deleteRowFromMap === "function"
    ) {
      gridRef.current.deleteRowFromMap(objectId);
    }
  };

  // 그리드에서 행 선택 시 맵의 포인트 하이라이트
  const handleGridRowFocus = (rowKey: string, objectId: number) => {
    if (mapRef.current && typeof mapRef.current.highlightFeatureAndPan === "function") {
      mapRef.current.highlightFeatureAndPan(objectId);
    }
  };

  // 맵에서 feature 선택 시 그리드의 행 선택
  const handleMapFeatureSelect = (objectId: number) => {
    if (
      gridRef.current &&
      typeof gridRef.current.selectRowFromMap === "function"
    ) {
      gridRef.current.selectRowFromMap(objectId);
    }
  };

  // 다음 임무 objectId 계산
  const getNextMissionObjectId = (): number => {
    const features = missionData.features;
    if (!features || features.length === 0) return 1;

    const maxId = features.reduce((max, feature) => {
      const id = feature.objectId ? parseInt(feature.objectId.toString()) : 0;
      return id > max ? id : max;
    }, 0);

    return maxId + 1;
  };

  // 맵에서 임무 feature 추가 시 그리드에 행 추가
  const handleMissionFeatureAdded = (featureData: Feature<Geometry>) => {
    if (
      gridRef.current &&
      typeof gridRef.current.addMissionRowFromMap === "function"
    ) {
      gridRef.current.addMissionRowFromMap(featureData);
    }
  };

  return (
    <Box sx={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="GCP" />
          <Tab label="이착륙" />
          <Tab label="임무" />
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, display: "flex" }}>
        <Box sx={{ flex: 1 }}>
          <MapTest
            ref={mapRef}
            gcpData={gcpData}
            modifiedData={modifiedData}
            handleMapPointAdded={handleMapPointAdded}
            handleFeatureMoved={handleFeatureMoved}
            handleFeatureDeleted={handleFeatureDeleted}
            currentTab={currentTab}
            onFeatureSelect={handleMapFeatureSelect}
            onMissionFeatureAdded={handleMissionFeatureAdded}
            getNextMissionObjectId={getNextMissionObjectId}
          />
        </Box>
        <Box sx={{ width: "400px", height: "100%" }}>
          {getCurrentGrid()}
        </Box>
      </Box>
    </Box>
  );
};

export default GISMAP;
