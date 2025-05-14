import { useState, useEffect, useRef } from "react";
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
const TestGrid = () => {
  // 그리드에 표시될 데이터 상태
  const [data, setData] = useState([]);
  // 그리드 컴포넌트에 대한 참조
  const gridRef = useRef(null);

  // 데이터 fetch 및 초기 포커스
  useEffect(() => {
    fetch("/jsondatas/gcpData.json")
      .then((res) => res.json())
      .then((jsonData) => {
        // 위도/경도/고도 값을 문자열로 변환
        const processedData = jsonData.map((item) => ({
          ...item,
          lat: item.lat.toString(),
          lon: item.lon.toString(),
          rel_alt: item.rel_alt.toString(),
        }));
        setData(processedData);
        setTimeout(() => {
          if (gridRef.current && processedData.length > 0) {
            const grid = gridRef.current.getInstance();
            grid.focus(0, "name");
            handleFocusChange({ rowKey: 0 });
          }
        }, 100);
      });
  }, []);

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
  };

  // 행 추가
  const handleAddRow = () => {
    if (!gridRef.current) return;
    const grid = gridRef.current.getInstance();
    const gridData = grid.getData();
    const lastRow = gridData.length > 0 ? gridData[gridData.length - 1] : null;
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
    markModifiedRowsAndCells();
  };

  // 셀 변경 시 변경 표시 갱신
  const handleAfterChange = () => {
    markModifiedRowsAndCells();
  };

  return (
    <div>
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
      <div style={{ width: "100%", height: "400px" }}>
        <Grid
          ref={gridRef}
          data={data}
          columns={columns}
          rowHeight={40}
          bodyHeight={600}
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
};

export default TestGrid;
