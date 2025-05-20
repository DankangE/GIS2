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

// 타입 정의
interface PointData {
  objectId: number;
  name: string;
  lat: string | number;
  lon: string | number;
  rel_alt?: string | number;
  note?: string;
  rowKey?: number;
  _attributes?: {
    rowNum: number;
  };
}

interface GridRef {
  getInstance: () => {
    resetData: (data: PointData[]) => void;
    getData: () => PointData[];
    getRowAt: (index: number) => { rowKey: number };
    focus: (rowKey: number, columnName: string) => void;
    getModifiedRows: () => {
      updatedRows: PointData[];
      createdRows: PointData[];
    };
    addCellClassName: (rowKey: number, columnName: string, className: string) => void;
    removeRowClassName: (rowKey: number, className: string) => void;
    addRowClassName: (rowKey: number, className: string) => void;
    getRow: (rowKey: number) => PointData;
    appendRow: (row: PointData, options: { focus: boolean }) => void;
    removeRow: (rowKey: number) => void;
    getFocusedCell: () => { rowKey: number } | null;
    getColumnValues: (columnName: string) => any[];
    setColumnValues: (columnName: string, values: any[]) => void;
    clear: () => void;
  };
}

interface GCPGridProps {
  gcpData: PointData[];
  handleGridDataChange: (data: PointData[]) => void;
  handleGridSave: (data: PointData[]) => void;
  handleRequestAddPoint: (row: PointData) => void;
  handleRowUpdate: (row: PointData) => void;
  handleDeleteRow: (objectId: number) => void;
  onRowFocus: (rowKey: number, objectId: number) => void;
}

interface GCPGridRef {
  addRowFromMap: (row: PointData) => void;
  updateRowFromMap: (row: PointData) => void;
  deleteRowFromMap: (objectId: number) => void;
  focusRowByObjectId: (objectId: number) => void;
  clearAllSelectedBg: () => void;
  getAllObjectIds: () => number[];
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

const REQUIRED_FIELDS = [
  { key: "name", label: "이름" },
  { key: "lat", label: "위도" },
  { key: "lon", label: "경도" },
] as const;

/**
 * 지리좌표(GCP) 데이터를 표시하고 관리하는 그리드 컴포넌트
 */
const GCPGrid = forwardRef<GCPGridRef, GCPGridProps>(
  (
    {
      gcpData,
      handleGridDataChange,
      handleGridSave,
      handleRequestAddPoint,
      handleRowUpdate,
      handleDeleteRow: onDeleteRow,
      onRowFocus,
    },
    ref
  ) => {
    // 그리드에 표시될 데이터 상태
    const [data, setData] = useState<PointData[]>([]);
    // 그리드 컴포넌트에 대한 참조
    const [gridData, setGridData] = useState<PointData[]>(gcpData);
    const gridRef = useRef<GridRef>(null);

    // gcpData가 변경될 때 gridData 업데이트
    useEffect(() => {
      setGridData(gcpData);
    }, [gcpData]);

    // gridData가 변경될 때 부모 컴포넌트에 알림
    useEffect(() => {
      handleGridDataChange(gridData);
    }, []);

    // 초기 데이터 설정
    useEffect(() => {
      if (gridRef.current && gcpData) {
        const grid = gridRef.current.getInstance();
        grid.resetData(gcpData);
        setData(gcpData);

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
    }, [gcpData]);

    // 유효성 검사 함수
    const validateRows = (rows: PointData[]): boolean => {
      for (const row of rows) {
        for (const field of REQUIRED_FIELDS) {
          if (!row[field.key] || row[field.key].toString().trim() === "") {
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
     * 그리드 컬럼 정의 - 이름, 위도, 경도, 고도, 비고 표시
     */
    const columns = [
      {
        name: "name",
        header: "이름",
        width: 150,
        editor: { type: "text", options: { placeholder: "*필수값입니다." } },
        sortable: true,
      },
      // 위도 컬럼
      {
        name: "lat",
        header: "위도",
        width: 120,
        editor: {
          type: "text",
          options: { useViewMode: false, placeholder: "*필수값입니다." },
        },
        align: "right",
      },
      // 경도 컬럼
      {
        name: "lon",
        header: "경도",
        width: 120,
        editor: {
          type: "text",
          options: { useViewMode: false, placeholder: "*필수값입니다." },
        },
        align: "right",
      },
      {
        name: "rel_alt",
        header: "고도",
        width: 100,
        editor: "text",
        align: "right",
      },
      { name: "note", header: "비고", width: 570, editor: "text" },
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
          objectId: newId,
          name: "",
          lat: "",
          lon: "",
          rel_alt: "",
          note: "",
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

      // 삭제 후 바로 아래 행 선택
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
        if (nextFocusRowKey === null && sortedRowKeys.length > 0) {
          nextFocusRowKey = sortedRowKeys[sortedRowKeys.length - 1];
        }
        if (nextFocusRowKey !== null) {
          grid.focus(nextFocusRowKey, "name");
          handleFocusChange({ rowKey: nextFocusRowKey });
        }
      }, 50);
    };

    // 셀 클릭 이벤트 핸들러
    const handleCellClick = (ev: { rowKey: number }): void => {
      handleFocusChange(ev);
    };

    // 모든 선택 배경색 초기화
    const clearAllSelectedBg = (): void => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const data = grid.getData();
      data.forEach((row) => {
        if (row.rowKey !== undefined) {
          grid.removeRowClassName(row.rowKey, "selected-bg");
        }
      });
    };

    // 변경사항 저장
    const handleSaveChanges = async (): Promise<void> => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const { updatedRows, createdRows } = grid.getModifiedRows();
      const allRows = [...updatedRows, ...createdRows];

      // 유효성 검사
      if (!validateRows(allRows)) {
        return;
      }

      // 저장할 데이터 준비
      const dataToSave = grid.getData().map((row) => ({
        objectId: row.objectId,
        name: row.name,
        lat: row.lat,
        lon: row.lon,
        rel_alt: row.rel_alt || "",
        note: row.note || "",
      }));

      // 부모 컴포넌트에 저장 요청
      if (typeof handleGridSave === "function") {
        await handleGridSave(dataToSave);
      }

      // 저장 후 그리드 초기화
      grid.clear();
      grid.resetData(dataToSave);
      setTimeout(markModifiedRowsAndCells, 50);
    };

    // 셀 변경 후 처리
    const handleAfterChange = (ev: { rowKey: number; columnName: string }): void => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const { rowKey, columnName } = ev;
      const rowData = grid.getRow(rowKey);
      if (!rowData) return;

      // 변경된 데이터를 부모 컴포넌트에 전달
      if (typeof handleRowUpdate === "function") {
        handleRowUpdate(rowData);
      }

      // 변경 표시
      markModifiedRowsAndCells();
    };

    // 부모 컴포넌트에서 사용할 수 있는 메서드들
    useImperativeHandle(ref, () => ({
      addRowFromMap: (row: PointData) => {
        if (!gridRef.current) return;
        const grid = gridRef.current.getInstance();
        grid.appendRow(row, { focus: true });
        setTimeout(markModifiedRowsAndCells, 50);
      },
      updateRowFromMap: (row: PointData) => {
        if (!gridRef.current) return;
        const grid = gridRef.current.getInstance();
        const data = grid.getData();
        const targetRow = data.find((r) => r.objectId === row.objectId);
        if (targetRow && targetRow.rowKey !== undefined) {
          grid.setColumnValues("name", [row.name]);
          grid.setColumnValues("lat", [row.lat]);
          grid.setColumnValues("lon", [row.lon]);
          grid.setColumnValues("rel_alt", [row.rel_alt]);
          grid.setColumnValues("note", [row.note]);
          setTimeout(markModifiedRowsAndCells, 50);
        }
      },
      deleteRowFromMap: (objectId: number) => {
        if (!gridRef.current) return;
        const grid = gridRef.current.getInstance();
        const data = grid.getData();
        const targetRow = data.find((row) => row.objectId === objectId);
        if (targetRow && targetRow.rowKey !== undefined) {
          grid.removeRow(targetRow.rowKey);
          setTimeout(markModifiedRowsAndCells, 50);
        }
      },
      focusRowByObjectId: (objectId: number) => {
        if (!gridRef.current) return;
        const grid = gridRef.current.getInstance();
        const data = grid.getData();
        const targetRow = data.find((row) => row.objectId === objectId);
        if (targetRow && targetRow.rowKey !== undefined) {
          grid.focus(targetRow.rowKey, "name");
          handleFocusChange({ rowKey: targetRow.rowKey });
        }
      },
      clearAllSelectedBg,
      getAllObjectIds: () => {
        if (!gridRef.current) return [];
        const grid = gridRef.current.getInstance();
        return grid.getData().map((row) => row.objectId);
      },
    }));

    return (
      <div style={{ height: "100%" }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ mb: 2 }}
        >
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddRow}
          >
            행 추가
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteRow}
          >
            행 삭제
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSaveChanges}
          >
            저장
          </Button>
        </Stack>
        <Grid
          ref={gridRef}
          data={gridData}
          columns={columns}
          onFocusChange={handleFocusChange}
          onCellClick={handleCellClick}
          onAfterChange={handleAfterChange}
          rowHeight={35}
          bodyHeight={500}
          scrollX={true}
          scrollY={true}
          columnOptions={{
            resizable: true,
          }}
        />
      </div>
    );
  }
);

export default GCPGrid;
