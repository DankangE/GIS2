import React, { useEffect, useRef } from "react";

const AddButton = ({ onToggleAddingMode }) => {
  const buttonRef = useRef(null);
  const isAddingRef = useRef(false);

  // 버튼 상태 갱신 함수 - 컴포넌트 외부에서도 접근 가능하도록 수정
  const updateButtonState = (isAdding) => {
    if (!buttonRef.current) return;

    isAddingRef.current = isAdding;

    if (isAddingRef.current) {
      buttonRef.current.innerText = "취소";
      buttonRef.current.style.backgroundColor = "#d32f2f";
    } else {
      buttonRef.current.innerText = "포인트 추가";
      buttonRef.current.style.backgroundColor = "#1976d2";
    }
  };

  useEffect(() => {
    const button = buttonRef.current;

    const handleClick = () => {
      const newState = !isAddingRef.current;
      updateButtonState(newState);

      // 상위 컴포넌트에 상태 변경 알림
      onToggleAddingMode(newState);
    };

    // 상위 컴포넌트에서 상태 변경 시 처리
    const originalCallback = onToggleAddingMode;
    const newCallback = (isAdding) => {
      // 상위 컴포넌트에서 상태가 변경되면 버튼 상태도 동기화
      if (isAddingRef.current !== isAdding) {
        updateButtonState(isAdding);
      }
      return originalCallback(isAdding);
    };

    // 콜백 함수 갱신
    onToggleAddingMode.reset = (value) => {
      updateButtonState(value);
    };

    // 이벤트 리스너 등록
    if (button) {
      button.addEventListener("click", handleClick);
    }

    return () => {
      if (button) {
        button.removeEventListener("click", handleClick);
      }
    };
  }, [onToggleAddingMode]);

  return (
    <button
      ref={buttonRef}
      className="add-point-button"
      style={{
        position: "absolute",
        top: "20px",
        right: "20px",
        zIndex: "1000",
        padding: "8px 16px",
        backgroundColor: "#1976d2",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      포인트 추가
    </button>
  );
};

export default AddButton;
