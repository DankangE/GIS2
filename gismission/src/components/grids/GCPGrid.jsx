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
 * 지리좌표(GCP) 데이터를 표시하고 관리하는 그리드 컴포넌트
 */
const GCPGrid = forwardRef(
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
    const [data, setData] = useState([]);
    // 그리드 컴포넌트에 대한 참조
    const [gridData, setGridData] = useState(gcpData);
    const gridRef = useRef(null);

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
    const validateRows = (rows) => {
      for (const row of rows) {
        for (const field of REQUIRED_FIELDS) {
          if (!row[field.key] || row[field.key].toString().trim() === "") {
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
    const markModifiedRowsAndCells = () => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const { updatedRows, createdRows } = grid.getModifiedRows();
      // 표시 초기화 생략(덮어쓰기 방식)
      updatedRows.forEach((row) => {
        grid.addCellClassName(row.rowKey, "_number", "updated-bg");
      });
      createdRows.forEach((row) => {
        grid.addCellClassName(row.rowKey, "_number", "created-bg");
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
    const handleFocusChange = (ev) => {
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
    const handleAddRow = () => {
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
    const handleDeleteRow = () => {
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

      // 삭제 후 첫 번째 행 선택
      setTimeout(() => {
        if (grid.getData().length > 0) {
          const firstRowKey = grid.getRowAt(0).rowKey;
          grid.focus(firstRowKey, "name");
          handleFocusChange({ rowKey: firstRowKey });
        }
      }, 100);
    };

    // 셀 클릭 시 편집 모드 진입
    const handleCellClick = (ev) => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const { rowKey, columnName } = ev;
      const focusedCell = grid.getFocusedCell();
      if (
        focusedCell &&
        focusedCell.rowKey === rowKey &&
        focusedCell.columnName === columnName
      ) {
        grid.startEditing(rowKey, columnName);
      }
    };

    // 모든 행의 selected-bg 배경색 초기화
    const clearAllSelectedBg = () => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const allData = grid.getData();
      allData.forEach((row) => {
        grid.removeRowClassName(row.rowKey, "selected-bg");
      });
    };

    // 저장 버튼 클릭
    const handleSaveChanges = () => {
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      grid.finishEditing();
      const allData = grid.getData();
      if (!validateRows(allData)) return;

      // 위도, 경도, 고도를 Number로 변환
      const processedData = allData.map((item) => ({
        ...item,
        lat: Number(item.lat),
        lon: Number(item.lon),
        rel_alt: Number(item.rel_alt),
      }));

      const modifiedRows = grid.getModifiedRows();
      console.log("수정된 행:", modifiedRows.updatedRows);
      console.log("추가된 행:", modifiedRows.createdRows);
      console.log("삭제된 행:", modifiedRows.deletedRows);
      alert("변경된 데이터가 콘솔에 출력되었습니다.");

      // 저장 전에 모든 선택 배경색 초기화
      clearAllSelectedBg();
      handleGridSave(processedData);

      // 저장 후 첫 번째 행 선택
      setTimeout(() => {
        if (gridRef.current && grid.getData().length > 0) {
          const firstRowKey = grid.getRowAt(0).rowKey;
          grid.focus(firstRowKey, "name");
          handleFocusChange({ rowKey: firstRowKey });
        }
      }, 200);
    };

    // 저장 후 데이터 재조회
    useEffect(() => {
      if (gridRef.current && gcpData) {
        const grid = gridRef.current.getInstance();
        grid.resetData(gcpData);
        setData(gcpData);
        setTimeout(() => {
          if (gridRef.current && gcpData.length > 0) {
            const grid = gridRef.current.getInstance();
            grid.focus(0, "name");
            handleFocusChange({ rowKey: 0 });
          }
        }, 100);
      }
    }, [gcpData]);

    // 셀 변경 시 변경 표시 갱신 및 포인트 추가 요청, 그리고 row 업데이트 콜백 호출
    const handleAfterChange = (ev) => {
      markModifiedRowsAndCells();
      console.log("handleAfterChange 호출", ev);
      if (!gridRef.current) return;
      const grid = gridRef.current.getInstance();
      const allData = grid.getData();

      // 변경된 row만 추출
      if (ev && ev.changes && ev.changes.length > 0) {
        ev.changes.forEach((change) => {
          const rowKey = change.rowKey;
          const columnName = change.columnName;
          const row = allData.find((r) => r.rowKey === rowKey);

          // name, lat, lon 컬럼이 변경된 경우 map에 업데이트 요청
          if (
            row &&
            typeof handleRowUpdate === "function" &&
            (columnName === "name" ||
              columnName === "lat" ||
              columnName === "lon")
          ) {
            handleRowUpdate(row);
          }
        });
      }

      // 기존 포인트 추가 요청 로직
      allData.forEach((row) => {
        if (
          row.objectId !== undefined &&
          row.lat &&
          row.lon &&
          !isNaN(Number(row.lat)) &&
          !isNaN(Number(row.lon)) &&
          typeof handleRequestAddPoint === "function"
        ) {
          handleRequestAddPoint(row);
        }
      });
    };

    // 외부에서 호출 가능한 addRowFromMap 메서드
    useImperativeHandle(ref, () => ({
      addRowFromMap: (row) => {
        if (!gridRef.current || !row) return;
        const grid = gridRef.current.getInstance();
        // 이미 해당 objectId의 행이 있으면 추가하지 않음
        const exists = grid.getData().some((r) => r.objectId === row.objectId);
        if (
          !exists &&
          row.lat &&
          row.lon &&
          !isNaN(Number(row.lat)) &&
          !isNaN(Number(row.lon))
        ) {
          grid.appendRow({
            objectId: row.objectId,
            name: "",
            lat: row.lat,
            lon: row.lon,
            rel_alt: "",
            note: "",
          });
        }
      },
      updateRowFromMap: (row) => {
        if (!gridRef.current || !row) return;
        const grid = gridRef.current.getInstance();
        const allData = grid.getData();
        const idx = allData.findIndex((r) => r.objectId === row.objectId);
        if (idx !== -1) {
          // lat/lon만 갱신
          grid.setValue(idx, "lat", row.lat);
          grid.setValue(idx, "lon", row.lon);
        }
      },
      deleteRowFromMap: (objectId) => {
        if (!gridRef.current || !objectId) return;
        const grid = gridRef.current.getInstance();
        const allData = grid.getData();
        const rowToDelete = allData.find((row) => row.objectId === objectId);
        if (rowToDelete) {
          grid.removeRow(rowToDelete.rowKey);
          setTimeout(markModifiedRowsAndCells, 50);

          // 삭제 후 첫 번째 행 선택
          setTimeout(() => {
            if (grid.getData().length > 0) {
              const firstRowKey = grid.getRowAt(0).rowKey;
              grid.focus(firstRowKey, "name");
              handleFocusChange({ rowKey: firstRowKey });
            }
          }, 100);
        }
      },
      focusRowByObjectId: (objectId) => {
        if (!gridRef.current || objectId === undefined) return;
        const grid = gridRef.current.getInstance();
        const allData = grid.getData();
        const row = allData.find((r) => r.objectId === objectId);
        if (row) {
          grid.focus(row.rowKey, "name");
          handleFocusChange({ rowKey: row.rowKey });
        }
      },
      clearAllSelectedBg: () => {
        if (!gridRef.current) return;
        const grid = gridRef.current.getInstance();
        const allData = grid.getData();
        allData.forEach((row) => {
          grid.removeRowClassName(row.rowKey, "selected-bg");
        });
      },
      clearSelection: () => {
        if (!gridRef.current) return;
        const grid = gridRef.current.getInstance();
        const allData = grid.getData();
        allData.forEach((row) => {
          grid.removeRowClassName(row.rowKey, "selected-bg");
        });
      },
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
            ondbClick={handleCellClick}
            onAfterChange={handleAfterChange}
          />
        </div>
      </div>
    );
  }
);

export default GCPGrid;
