import React, { useState, useEffect, useRef } from "react";
import { Tabs, Tab, Box } from "@mui/material";
import MapTest from "../components/maps/Map.jsx";
import GCPGrid from "../components/grids/GCPGrid.jsx";
import LandingGrid from "../components/grids/LandingGrid.jsx";
import MissionGrid from "../components/grids/MissionGrid.jsx";

export default function GISMAP() {
  // 현재 선택된 탭 상태
  const [currentTab, setCurrentTab] = useState(0);

  // 각 탭별 데이터 상태
  const [gcpData, setGcpData] = useState([]);
  const [landingData, setLandingData] = useState([]);
  const [missionData, setMissionData] = useState([]);

  // 수정된 데이터 상태
  const [modifiedData, setModifiedData] = useState([]);

  // refs
  const mapRef = useRef();
  const gridRef = useRef(null);

  useEffect(() => {
    if (gridRef.current) {
      console.log("gridRef.current.clientHeight", gridRef.current.clientHeight);
    }
  }, []);

  // 탭 변경 핸들러
  const handleTabChange = (event, newValue) => {
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
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        // GCP 데이터 로드
        const gcpResponse = await fetch("/jsondatas/gcpData.json");
        const gcpData = await gcpResponse.json();
        setGcpData(gcpData);

        // 이착륙 데이터 로드
        const landingResponse = await fetch("/jsondatas/landingData.json");
        const landingData = await landingResponse.json();
        setLandingData(landingData);

        // 임무 데이터 로드
        const missionResponse = await fetch("/jsondatas/missionData.json");
        const missionData = await missionResponse.json();
        setMissionData(missionData);
      } catch (error) {
        console.error("데이터 로드 실패:", error);
      }
    };
    loadData();
  }, []);

  // 현재 탭에 맞는 데이터 반환
  const getCurrentData = () => {
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
  const handleGridDataChange = (changedData) => {
    setModifiedData(changedData);
  };

  // 그리드에서 저장 요청 처리
  const handleGridSave = (dataToSave) => {
    // TODO: 실제 저장 로직 구현
    console.log("저장할 데이터:", dataToSave);
    // 저장 후 전체 데이터 업데이트
    switch (currentTab) {
      case 0:
        setGcpData(dataToSave);
        break;
      case 1:
        setLandingData(dataToSave);
        break;
      case 2:
        setMissionData(dataToSave);
        break;
    }
    setModifiedData([]);
  };

  // 맵에서 포인트 추가 시 그리드에 행 추가
  const handleMapPointAdded = (row) => {
    if (
      gridRef.current &&
      typeof gridRef.current.addRowFromMap === "function"
    ) {
      gridRef.current.addRowFromMap(row);
    }
  };

  // 그리드에서 포인트 추가 요청 처리
  const handleRequestAddPoint = (row) => {
    if (mapRef.current && typeof mapRef.current.addPoint === "function") {
      mapRef.current.addPoint(row);
    }
  };

  // 그리드에서 행 수정 시 맵 feature 업데이트
  const handleRowUpdate = (row) => {
    if (mapRef.current && typeof mapRef.current.updateFeature === "function") {
      mapRef.current.updateFeature(row);
    }
  };

  // 그리드에서 행 삭제 시 맵의 포인트도 삭제
  const handleDeleteRow = (objectId) => {
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
  const handleFeatureMoved = (row) => {
    if (
      gridRef.current &&
      typeof gridRef.current.updateRowFromMap === "function"
    ) {
      console.log("맵에서 포인트 업데이트:", row);
      gridRef.current.updateRowFromMap(row);
    }
  };

  // 맵에서 포인트 삭제 시 그리드의 행도 삭제
  const handleFeatureDeleted = (objectId) => {
    if (
      gridRef.current &&
      typeof gridRef.current.deleteRowFromMap === "function"
    ) {
      gridRef.current.deleteRowFromMap(objectId);
    }
  };

  // 그리드 행 포커스 시 맵 오브젝트 하이라이트 및 패닝
  const handleGridRowFocus = (rowKey, objectId) => {
    mapRef.current?.highlightFeatureAndPan(objectId);
  };
  // 맵 오브젝트 선택 시 그리드 행 포커스
  const handleMapFeatureSelect = (objectId) => {
    gridRef.current?.focusRowByObjectId(objectId);
  };

  // 임무 기능이 추가될 때 그리드에 행 추가
  const handleMissionFeatureAdded = (featureData) => {
    console.log("맵에서 새 임무 추가됨:", featureData);

    // missionData 업데이트
    if (missionData && missionData.features) {
      // 기존 GeoJSON 구조가 있는 경우 feature 추가
      setMissionData((prev) => ({
        ...prev,
        features: [...prev.features, featureData],
      }));
    } else {
      // GeoJSON 구조가 없는 경우 새로 생성
      setMissionData({
        type: "FeatureCollection",
        features: [featureData],
      });
    }

    // 그리드 컴포넌트에 행 추가
    if (
      gridRef.current &&
      typeof gridRef.current.addRowFromMap === "function" &&
      currentTab === 2
    ) {
      gridRef.current.addRowFromMap(featureData);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Tabs
        value={currentTab}
        onChange={handleTabChange}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label="GCP" />
        <Tab label="이착륙" />
        <Tab label="임무" />
      </Tabs>

      <Box sx={{ display: "flex", flex: 1, gap: "16px", p: 2 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "16px",
          }}
        >
          {getCurrentGrid()}
        </div>
        <div
          style={{
            flex: 1.5,
            minWidth: 0,
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        >
          <MapTest
            ref={mapRef}
            gcpData={getCurrentData()}
            modifiedData={modifiedData}
            handleMapPointAdded={handleMapPointAdded}
            handleFeatureMoved={handleFeatureMoved}
            handleFeatureDeleted={handleFeatureDeleted}
            currentTab={currentTab}
            onFeatureSelect={handleMapFeatureSelect}
            onMissionFeatureAdded={handleMissionFeatureAdded}
          />
        </div>
      </Box>
    </div>
  );
}
