import React, {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import Grid from "@toast-ui/react-grid";
import "tui-grid/dist/tui-grid.css";
import { Button, Stack } from "@mui/material";
import KmlButton from "../buttons/KmlButton.jsx";
import { toLonLat } from "ol/proj";

interface MissionData {
  type: string;
  objectId?: number;
  name: string;
  geometry: string;
  coordinates: string;
  notes?: string;
  radius?: number | null;
  rowKey?: number;
  _attributes?: {
    rowNum: number;
  };
}

interface GridRef {
  getInstance: () => any;
}

interface MissionGridProps {
  missionData: {
    type: string;
    features: Array<{
      type: string;
      objectId?: number;
      properties?: {
        name: string;
        notes?: string;
      };
      geometry?: {
        type: string;
        coordinates: any;
        radius?: number;
      };
    }>;
  };
  handleGridDataChange: (data: any) => void;
  handleGridSave: (data: any) => void;
  handleRowUpdate: (data: MissionData) => void;
  handleDeleteRow: (objectId: number) => void;
  onRowFocus: (rowKey: number, objectId: number) => void;
}

interface MissionGridRef {
  getInstance: () => any;
  getData: () => MissionData[];
  resetData: (data: MissionData[]) => void;
  focus: (rowKey: number, columnName: string) => void;
  getRowAt: (index: number) => { rowKey: number };
  getRow: (rowKey: number) => MissionData;
  getFocusedCell: () => { rowKey: number } | null;
  removeRow: (rowKey: number) => void;
  appendRow: (data: MissionData, options: { focus: boolean }) => void;
  getModifiedRows: () => {
    updatedRows: MissionData[];
    createdRows: MissionData[];
  };
  addCellClassName: (rowKey: number, columnName: string, className: string) => void;
  removeRowClassName: (rowKey: number, className: string) => void;
  addRowClassName: (rowKey: number, className: string) => void;
}

// CSS 스타일 추가 - blue, orange-border, green-border, yellow-bg 클래스 정의
const gridStyle = document.createElement("style");
gridStyle.textContent = `
  .selected-bg {
    background-color: #e5f6ff !important;
  }
  .updated-bg {
    background-color: #fff9c4 !important;
  }
  .created-bg {
    background-color: #f0fff0 !important;
  }
`;
document.head.appendChild(gridStyle);

const REQUIRED_FIELDS = [{ key: "name", label: "이름" }];

/**
 * 임무 지점 데이터를 표시하고 관리하는 그리드 컴포넌트
 */
const MissionGrid = forwardRef<MissionGridRef, MissionGridProps>(
  (
    {
      missionData,
      handleGridDataChange,
      handleGridSave,
      handleRowUpdate,
      handleDeleteRow: onDeleteRow,
      onRowFocus,
    },
    ref
  ) => {
    // 그리드에 표시될 데이터 상태
    const [data, setData] = useState<MissionData[]>([]);
    // 그리드 컴포넌트에 대한 참조
    const [gridData, setGridData] = useState<MissionData[]>([]);
    const gridRef = useRef<GridRef>(null);

    useEffect(() => {
      if (missionData) {
        console.log("GISMAP에서 missionData:", missionData);
      }
    }, [missionData]);

    // missionData가 변경될 때 gridData 업데이트
    useEffect(() => {
      if (missionData && missionData.features) {
        const formattedData = missionData.features.map((feature, idx) => ({
          type: feature.geometry?.type ?? "",
          id: feature.objectId ?? idx,
          objectId: feature.objectId ?? idx + 1,
          name: feature.properties?.name ?? "",
          geometry: `${feature.geometry?.type ?? ""}: ${
            JSON.stringify(feature.geometry?.coordinates) ?? "[]"
          }`,
          coordinates: JSON.stringify(feature.geometry?.coordinates) ?? "[]",
          notes: feature.properties?.notes ?? "",
          radius: feature.geometry?.radius ?? null,
        }));
        setGridData(formattedData);
        setData(formattedData);
      }
    }, [missionData]);

    // gridData가 변경될 때 부모 컴포넌트에 알림
    useEffect(() => {
      if (gridData.length > 0) {
        handleGridDataChange({
          type: "FeatureCollection",
          features: gridData.map((row) => ({
            type: "Feature",
            objectId: row.objectId,
            properties: {
              name: row.name,
              notes: row.notes,
            },
            geometry: {
              type: row.type,
              coordinates: tryParseJSON(row.coordinates) || [],
              radius: row.radius,
            },
          })),
        });
      }
    }, [gridData]);

    // JSON 문자열을 객체로 변환 (실패 시 null 반환)
    const tryParseJSON = (jsonString: string): any => {
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        console.error("JSON 파싱 오류:", e);
        return null;
      }
    };

    // 초기 데이터 설정
    useEffect(() => {
      if (gridRef.current && gridData.length > 0) {
        const grid = gridRef.current.getInstance();
        grid.resetData(gridData);
        setData(gridData);

        // 항상 첫 번째 행 선택
        setTimeout(() => {
          if (gridRef.current && grid.getData().length > 0) {
            // 데이터가 있으면 첫 번째 행 선택
            const firstRowKey = grid.getRowAt(0).rowKey;
            grid.focus(firstRowKey, "name");
            handleFocusChange({ rowKey: firstRowKey });
          }
        }, 100);
      }
    }, [gridData]);

    // 유효성 검사 함수
    const validateRows = (rows: MissionData[]): boolean => {
      for (const row of rows) {
        // 필수 필드 검사
        for (const field of REQUIRED_FIELDS) {
          if (!row[field.key as keyof MissionData] || row[field.key as keyof MissionData]?.toString().trim() === "") {
            alert(
              `${field.label}은(는) 필수 입력 항목입니다. 행: ${
                row._attributes ? row._attributes.rowNum : ""
              }`
            );
            if (gridRef.current) {
              gridRef.current.getInstance().focus(row.rowKey!, field.key);
            }
            return false;
          }
        }

        // 좌표 JSON 형식 검사
        if (row.coordinates) {
          try {
            const coordsObj = JSON.parse(row.coordinates);
            // 타입에 따른 좌표 형식 검증
            if (row.type === "Point" && !Array.isArray(coordsObj)) {
              throw new Error("Point 좌표는 배열 형식이어야 합니다");
            } else if (
              row.type === "LineString" &&
              (!Array.isArray(coordsObj) || !Array.isArray(coordsObj[0]))
            ) {
              throw new Error("LineString 좌표는 2차원 배열 형식이어야 합니다");
            } else if (
              row.type === "Polygon" &&
              (!Array.isArray(coordsObj) ||
                !Array.isArray(coordsObj[0]) ||
                !Array.isArray(coordsObj[0][0]))
            ) {
              throw new Error("Polygon 좌표는 3차원 배열 형식이어야 합니다");
            }
          } catch (e) {
            alert(
              `좌표 형식이 올바르지 않습니다. 행: ${
                row._attributes ? row._attributes.rowNum : ""
              }\n오류: ${e instanceof Error ? e.message : String(e)}`
            );
            if (gridRef.current) {
              gridRef.current.getInstance().focus(row.rowKey!, "coordinates");
            }
            return false;
          }
        }
      }
      return true;
    };

    // 변경 표시 함수
    const markModifiedRowsAndCells = (): void => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const { updatedRows, createdRows } = grid.getModifiedRows();
      // 표시 초기화 생략(덮어쓰기 방식)
      updatedRows.forEach((row) => {
        grid.addCellClassName(row.rowKey!, "_number", "updated-bg");
      });
      createdRows.forEach((row) => {
        grid.addCellClassName(row.rowKey!, "_number", "created-bg");
      });
    };

    /**
     * 그리드 컬럼 정의 - 이름, geometry, 비고 표시
     */
    const columns = [
      {
        name: "name",
        header: "이름",
        width: 150,
        editor: "text",
        sortable: true,
      },
      { name: "notes", header: "비고", width: 250, editor: "text" },
      {
        name: "geometry",
        header: "Geometry",
        width: 420,
        formatter: ({ row }: { row: MissionData }) => {
          if (!row) return "";
          const type = row.type || "";
          const coordinates = row.coordinates || "[]";
          return `${type}: ${coordinates}`;
        },
        editor: false,
      },
    ];

    // 포커스 행 스타일 처리
    const handleFocusChange = (ev: { rowKey: number }): void => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const { rowKey } = ev;
      if (rowKey === null || rowKey === undefined) return;
      if (!handleFocusChange.prevRowKey && handleFocusChange.prevRowKey !== 0) {
        handleFocusChange.prevRowKey = null;
      }
      if (
        handleFocusChange.prevRowKey !== null &&
        handleFocusChange.prevRowKey !== rowKey
      ) {
        grid.removeRowClassName(handleFocusChange.prevRowKey, "selected-bg");
      }
      grid.addRowClassName(rowKey, "selected-bg");
      handleFocusChange.prevRowKey = rowKey;
      markModifiedRowsAndCells();

      // 추가: 포커스된 row의 objectId를 상위로 전달
      if (typeof onRowFocus === "function") {
        const rowData = grid.getRow(rowKey);
        if (rowData && rowData.objectId !== undefined) {
          onRowFocus(rowKey, rowData.objectId);
        }
      }
    };

    // 행 추가
    const handleAddRow = (): void => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const gridData = grid.getData();
      const lastRow =
        gridData.length > 0 ? gridData[gridData.length - 1] : null;
      const newId = lastRow && lastRow.objectId ? lastRow.objectId + 1 : 1;
      grid.appendRow(
        {
          type: "Point",
          objectId: newId,
          name: "",
          geometry: "Point: []",
          coordinates: "[]",
          notes: "",
        },
        { focus: true }
      );
      setTimeout(markModifiedRowsAndCells, 50);
    };

    // 행 삭제
    const handleDeleteRow = (): void => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const selectedRowKey = grid.getFocusedCell()?.rowKey;
      if (selectedRowKey === null || selectedRowKey === undefined) {
        alert("삭제할 행을 선택해주세요.");
        return;
      }
      const allData = grid.getData();
      const rowToDelete = allData.find((row) => row.rowKey === selectedRowKey);
      if (rowToDelete && rowToDelete.objectId) {
        // 맵에서 포인트 삭제
        if (typeof onDeleteRow === "function") {
          onDeleteRow(rowToDelete.objectId);
        }
      }

      grid.removeRow(selectedRowKey);
      setTimeout(markModifiedRowsAndCells, 50);

      // 삭제 후 아래 행 또는 위 행을 안전하게 선택 (rowKey 연속성 보장 X)
      setTimeout(() => {
        const data = grid.getData();
        if (data.length === 0) return;

        // 현재 남아있는 행들의 rowKey를 오름차순 정렬
        const sortedRowKeys = data
          .map((row) => row.rowKey)
          .sort((a, b) => a - b);

        // 삭제된 rowKey가 배열에서 어디에 있었는지 찾음
        let nextFocusRowKey = null;
        for (let i = 0; i < sortedRowKeys.length; i++) {
          if (sortedRowKeys[i] > selectedRowKey) {
            nextFocusRowKey = sortedRowKeys[i];
            break;
          }
        }
        // 아래 행이 있으면 그 행을 선택, 없으면 위 행을 선택
        if (nextFocusRowKey !== null) {
          grid.focus(nextFocusRowKey, "name");
          handleFocusChange({ rowKey: nextFocusRowKey });
        } else {
          // 아래 행이 없으면 가장 가까운 위의 행 선택 (즉, 마지막 행 삭제 시)
          for (let i = sortedRowKeys.length - 1; i >= 0; i--) {
            if (sortedRowKeys[i] < selectedRowKey) {
              nextFocusRowKey = sortedRowKeys[i];
              break;
            }
          }
          if (nextFocusRowKey !== null) {
            grid.focus(nextFocusRowKey, "name");
            handleFocusChange({ rowKey: nextFocusRowKey });
          }
        }
      }, 50);
    };

    // 셀 클릭 이벤트 처리
    const handleCellClick = (ev: { rowKey: number; columnName: string }): void => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const { rowKey } = ev;
      if (rowKey === null || rowKey === undefined) return;
      handleFocusChange({ rowKey });
    };

    // 모든 선택 배경 제거
    const clearAllSelectedBg = (): void => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const data = grid.getData();
      data.forEach((row: MissionData) => {
        if (row.rowKey !== undefined) {
          grid.removeRowClassName(row.rowKey, "selected-bg");
        }
      });
    };

    // 변경사항 저장
    const handleSaveChanges = (): void => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const { updatedRows, createdRows } = grid.getModifiedRows();
      const allModifiedRows = [...updatedRows, ...createdRows];

      if (allModifiedRows.length === 0) {
        alert("저장할 변경사항이 없습니다.");
        return;
      }

      if (!validateRows(allModifiedRows)) {
        return;
      }

      // 변경된 데이터를 부모 컴포넌트에 전달
      handleGridSave(allModifiedRows);
      markModifiedRowsAndCells();
    };

    // 데이터 변경 후 처리
    const handleAfterChange = (ev: { rowKey: number; columnName: string; value: any }): void => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const { rowKey, columnName, value } = ev;
      if (rowKey === null || rowKey === undefined) return;

      const rowData = grid.getRow(rowKey);
      if (rowData) {
        handleRowUpdate(rowData);
      }
      markModifiedRowsAndCells();
    };

    // KML 변환 함수
    const geojsonFeatureToKml = (feature: any): string => {
      const { type, properties, geometry } = feature;
      let kml = "";

      const convertCoord = (coord: number[]): string => {
        const [lon, lat] = toLonLat(coord);
        return `${lon},${lat},0`;
      };

      if (geometry.type === "Point") {
        const coord = convertCoord(geometry.coordinates);
        kml += `<Placemark>
          <name>${properties.name || ""}</name>
          <description>${properties.notes || ""}</description>
          <Point>
            <coordinates>${coord}</coordinates>
          </Point>
        </Placemark>`;
      } else if (geometry.type === "LineString") {
        const coords = geometry.coordinates.map(convertCoord).join(" ");
        kml += `<Placemark>
          <name>${properties.name || ""}</name>
          <description>${properties.notes || ""}</description>
          <LineString>
            <coordinates>${coords}</coordinates>
          </LineString>
        </Placemark>`;
      } else if (geometry.type === "Polygon") {
        const coords = geometry.coordinates[0].map(convertCoord).join(" ");
        kml += `<Placemark>
          <name>${properties.name || ""}</name>
          <description>${properties.notes || ""}</description>
          <Polygon>
            <outerBoundaryIs>
              <LinearRing>
                <coordinates>${coords}</coordinates>
              </LinearRing>
            </outerBoundaryIs>
          </Polygon>
        </Placemark>`;
      }

      return kml;
    };

    // KML 내보내기
    const exportKml = (): void => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const data = grid.getData();
      let kml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <name>Mission Points</name>`;

      data.forEach((row: MissionData) => {
        const feature = {
          type: "Feature",
          properties: {
            name: row.name,
            notes: row.notes,
          },
          geometry: {
            type: row.type,
            coordinates: tryParseJSON(row.coordinates),
            radius: row.radius,
          },
        };
        kml += geojsonFeatureToKml(feature);
      });

      kml += `
          </Document>
        </kml>`;

      const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mission_points.kml";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    // ref를 통해 외부에서 접근할 수 있는 메서드 정의
    useImperativeHandle(ref, () => ({
      getInstance: () => gridRef.current?.getInstance(),
      getData: () => gridRef.current?.getInstance().getData(),
      resetData: (data: MissionData[]) => gridRef.current?.getInstance().resetData(data),
      focus: (rowKey: number, columnName: string) => gridRef.current?.getInstance().focus(rowKey, columnName),
      getRowAt: (index: number) => gridRef.current?.getInstance().getRowAt(index),
      getRow: (rowKey: number) => gridRef.current?.getInstance().getRow(rowKey),
      getFocusedCell: () => gridRef.current?.getInstance().getFocusedCell(),
      removeRow: (rowKey: number) => gridRef.current?.getInstance().removeRow(rowKey),
      appendRow: (data: MissionData, options: { focus: boolean }) => gridRef.current?.getInstance().appendRow(data, options),
      getModifiedRows: () => gridRef.current?.getInstance().getModifiedRows(),
      addCellClassName: (rowKey: number, columnName: string, className: string) => gridRef.current?.getInstance().addCellClassName(rowKey, columnName, className),
      removeRowClassName: (rowKey: number, className: string) => gridRef.current?.getInstance().removeRowClassName(rowKey, className),
      addRowClassName: (rowKey: number, className: string) => gridRef.current?.getInstance().addRowClassName(rowKey, className),
    }));

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: "300px",
        }}
      >
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Button variant="contained" onClick={handleAddRow}>
            행 추가
          </Button>
          <Button variant="contained" onClick={handleDeleteRow}>
            행 삭제
          </Button>
          <Button variant="contained" onClick={handleSaveChanges}>
            저장
          </Button>
          <KmlButton onClick={exportKml} />
        </Stack>
        <div style={{ flex: 1, minHeight: 0, height: "calc(100% - 60px)" }}>
          <Grid
            ref={gridRef}
            data={data}
            columns={columns}
            rowHeight={40}
            bodyHeight={500}
            scrollX={true}
            scrollY={true}
            rowHeaders={["checkbox", "rowNum"]}
            sortable={true}
            onFocusChange={handleFocusChange}
            onCellClick={handleCellClick}
            onAfterChange={handleAfterChange}
          />
        </div>
      </div>
    );
  }
);

export default MissionGrid;
