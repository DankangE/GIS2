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

interface PointData {
  objectId?: number;
  name: string;
  lat: string | number;
  lon: string | number;
  note?: string;
  rowKey?: number;
  _attributes?: {
    rowNum: number;
  };
}

interface GridRef {
  getInstance: () => any;
}

interface LandingGridProps {
  landingData: PointData[];
  handleGridDataChange: (data: PointData[]) => void;
  handleGridSave: (data: PointData[]) => void;
  handleRequestAddPoint: (data: PointData) => void;
  handleRowUpdate: (data: PointData) => void;
  handleDeleteRow: (objectId: number) => void;
  onRowFocus: (rowKey: number, objectId: number) => void;
}

interface LandingGridRef {
  getInstance: () => any;
  getData: () => PointData[];
  resetData: (data: PointData[]) => void;
  focus: (rowKey: number, columnName: string) => void;
  getRowAt: (index: number) => { rowKey: number };
  getRow: (rowKey: number) => PointData;
  getFocusedCell: () => { rowKey: number } | null;
  removeRow: (rowKey: number) => void;
  appendRow: (data: PointData, options: { focus: boolean }) => void;
  getModifiedRows: () => {
    updatedRows: PointData[];
    createdRows: PointData[];
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

const REQUIRED_FIELDS = [
  { key: "name", label: "이름" },
  { key: "lat", label: "위도" },
  { key: "lon", label: "경도" },
];

/**
 * 지리좌표(Landing) 데이터를 표시하고 관리하는 그리드 컴포넌트
 */
const LandingGrid = forwardRef<LandingGridRef, LandingGridProps>(
  (
    {
      landingData,
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
    const [gridData, setGridData] = useState<PointData[]>(landingData);
    const gridRef = useRef<GridRef>(null);

    // landingData가 변경될 때 gridData 업데이트
    useEffect(() => {
      setGridData(landingData);
    }, [landingData]);

    // gridData가 변경될 때 부모 컴포넌트에 알림
    useEffect(() => {
      handleGridDataChange(gridData);
    }, []);

    // 초기 데이터 설정
    useEffect(() => {
      if (gridRef.current && landingData) {
        const grid = gridRef.current.getInstance();
        grid.resetData(landingData);
        setData(landingData);

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
    }, [landingData]);

    // 유효성 검사 함수
    const validateRows = (rows: PointData[]): boolean => {
      for (const row of rows) {
        for (const field of REQUIRED_FIELDS) {
          if (!row[field.key as keyof PointData] || row[field.key as keyof PointData]?.toString().trim() === "") {
            alert(
              `${field.label}은(는) 필수 입력 항목입니다. 행: ${
                row._attributes ? row._attributes.rowNum : ""
              }`
            );
            if (gridRef.current) {
              gridRef.current.getInstance().focus(row.rowKey, field.key);
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
      updatedRows.forEach((row : any) => {
        grid.addCellClassName(row.rowKey!, "_number", "updated-bg");
      });
      createdRows.forEach((row : any) => {
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
      data.forEach((row: PointData) => {
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

    // ref를 통해 외부에서 접근할 수 있는 메서드 정의
    useImperativeHandle(ref, () => ({
      getInstance: () => gridRef.current?.getInstance(),
      getData: () => gridRef.current?.getInstance().getData(),
      resetData: (data: PointData[]) => gridRef.current?.getInstance().resetData(data),
      focus: (rowKey: number, columnName: string) => gridRef.current?.getInstance().focus(rowKey, columnName),
      getRowAt: (index: number) => gridRef.current?.getInstance().getRowAt(index),
      getRow: (rowKey: number) => gridRef.current?.getInstance().getRow(rowKey),
      getFocusedCell: () => gridRef.current?.getInstance().getFocusedCell(),
      removeRow: (rowKey: number) => gridRef.current?.getInstance().removeRow(rowKey),
      appendRow: (data: PointData, options: { focus: boolean }) => gridRef.current?.getInstance().appendRow(data, options),
      getModifiedRows: () => gridRef.current?.getInstance().getModifiedRows(),
      addCellClassName: (rowKey: number, columnName: string, className: string) => gridRef.current?.getInstance().addCellClassName(rowKey, columnName, className),
      removeRowClassName: (rowKey: number, className: string) => gridRef.current?.getInstance().removeRowClassName(rowKey, className),
      addRowClassName: (rowKey: number, className: string) => gridRef.current?.getInstance().addRowClassName(rowKey, className),
    }));

    return (
      <div>
        <Grid
          ref={gridRef}
          data={data}
          columns={columns}
          rowHeight={25}
          onFocusChange={handleFocusChange}
          onCellClick={handleCellClick}
          onAfterChange={handleAfterChange}
        />
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button variant="contained" onClick={handleAddRow}>
            행 추가
          </Button>
          <Button variant="contained" onClick={handleDeleteRow}>
            행 삭제
          </Button>
          <Button variant="contained" onClick={handleSaveChanges}>
            저장
          </Button>
        </Stack>
      </div>
    );
  }
);

export default LandingGrid;
