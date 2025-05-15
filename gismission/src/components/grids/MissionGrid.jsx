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

const REQUIRED_FIELDS = [{ key: "name", label: "이름" }];

/**
 * 임무 지점 데이터를 표시하고 관리하는 그리드 컴포넌트
 */
const MissionGrid = forwardRef(
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
    const [data, setData] = useState([]);
    // 그리드 컴포넌트에 대한 참조
    const [gridData, setGridData] = useState([]);
    const gridRef = useRef(null);

    useEffect(() => {
      if (missionData) {
        console.log("GISMAP에서 missionData:", missionData);
      }
    }, [missionData]);

    // missionData가 변경될 때 gridData 업데이트
    useEffect(() => {
      if (missionData && missionData.features) {
        const formattedData = missionData.features.map((feature, idx) => ({
          id: feature.objectId ?? idx,
          name: feature.properties?.name ?? "",
          note: feature.properties?.notes ?? "",
          type: feature.geometry?.type ?? "",
        }));
        console.log("MissionGrid에서 formattedData:", formattedData);
        console.log("MissionGrid에서 formattedData:", formattedData);
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
              notes: row.note,
            },
            geometry: {
              type: row.type,
              coordinates: row.coordinates,
              radius: row.radius,
            },
          })),
        });
      }
    }, [gridData]);

    // 초기 데이터 설정
    useEffect(() => {
      if (gridRef.current && gridData.length > 0) {
        const grid = gridRef.current.getInstance();
        grid.resetData(gridData);
        setData(gridData);
        setTimeout(() => {
          if (gridRef.current && gridData.length > 0) {
            const grid = gridRef.current.getInstance();
            grid.focus(0, "name");
            handleFocusChange({ rowKey: 0 });
          }
        }, 100);
      }
    }, [gridData]);

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
     * 그리드 컬럼 정의 - 이름, 비고, 타입 표시
     */
    const columns = [
      {
        name: "name",
        header: "이름",
        width: 150,
        editor: "text",
        sortable: true,
      },
      { name: "type", header: "타입", width: 120, editor: "text" },
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
          type: "",
          note: "",
          coordinates: [],
          radius: null,
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
      const currentRowNum =
        allData.findIndex((row) => row.rowKey === selectedRowKey) + 1;
      if (currentRowNum < allData.length) {
        grid.focus(allData[currentRowNum].rowKey, "name");
      } else if (currentRowNum > 1) {
        grid.focus(allData[currentRowNum - 2].rowKey, "name");
      }
      grid.removeRow(selectedRowKey);
      setTimeout(markModifiedRowsAndCells, 50);
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

      const modifiedRows = grid.getModifiedRows();
      console.log("수정된 행:", modifiedRows.updatedRows);
      console.log("추가된 행:", modifiedRows.createdRows);
      console.log("삭제된 행:", modifiedRows.deletedRows);
      alert("변경된 데이터가 콘솔에 출력되었습니다.");

      // 저장 전에 모든 선택 배경색 초기화
      clearAllSelectedBg();
      handleGridSave({
        type: "FeatureCollection",
        features: allData.map((row) => ({
          type: "Feature",
          objectId: row.objectId,
          properties: {
            name: row.name,
            notes: row.note,
          },
          geometry: {
            type: row.type,
            coordinates: row.coordinates,
            radius: row.radius,
          },
        })),
      });
    };

    // 셀 변경 시 변경 표시 갱신 및 row 업데이트 콜백 호출
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

          // name 컬럼이 변경된 경우 map에 업데이트 요청
          if (
            row &&
            typeof handleRowUpdate === "function" &&
            columnName === "name"
          ) {
            handleRowUpdate(row);
          }
        });
      }
    };

    // 외부에서 호출 가능한 addRowFromMap 메서드
    useImperativeHandle(ref, () => ({
      addRowFromMap: (row) => {
        if (!gridRef.current || !row) return;
        const grid = gridRef.current.getInstance();
        // 이미 해당 objectId의 행이 있으면 추가하지 않음
        const exists = grid.getData().some((r) => r.objectId === row.objectId);
        if (!exists) {
          grid.appendRow({
            objectId: row.objectId,
            name: row.properties.name,
            type: row.geometry.type,
            note: row.properties.notes,
            coordinates: row.geometry.coordinates,
            radius: row.geometry.radius,
          });
        }
      },
      updateRowFromMap: (row) => {
        if (!gridRef.current || !row) return;
        const grid = gridRef.current.getInstance();
        const allData = grid.getData();
        const idx = allData.findIndex((r) => r.objectId === row.objectId);
        if (idx !== -1) {
          grid.setValue(idx, "name", row.properties.name);
          grid.setValue(idx, "note", row.properties.notes);
          grid.setValue(idx, "type", row.geometry.type);
          grid.setValue(idx, "coordinates", row.geometry.coordinates);
          grid.setValue(idx, "radius", row.geometry.radius);
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

export default MissionGrid;
