import React, { useEffect, useRef } from "react";

interface MoveButtonProps {
  onToggleMovingMode: {
    (isMoving: boolean): void,
    reset?: (value: boolean) => void,
  };
}

const MoveButton: React.FC<MoveButtonProps> = ({ onToggleMovingMode }) => {
  const buttonRef = useRef < HTMLButtonElement > null;
  const isMovingRef = useRef < boolean > false;

  // 버튼 상태 갱신 함수
  const updateButtonState = (isMoving: boolean): void => {
    if (!buttonRef.current) return;

    isMovingRef.current = isMoving;

    if (isMovingRef.current) {
      buttonRef.current.innerText = "이동 취소";
      buttonRef.current.style.backgroundColor = "#ff9800";
    } else {
      buttonRef.current.innerText = "포인트 이동";
      buttonRef.current.style.backgroundColor = "#2196F3";
    }
  };

  useEffect(() => {
    const button = buttonRef.current;

    const handleClick = (): void => {
      const newState = !isMovingRef.current;
      updateButtonState(newState);

      // 상위 컴포넌트에 상태 변경 알림
      onToggleMovingMode(newState);
    };

    // 콜백 함수 갱신
    onToggleMovingMode.reset = (value: boolean): void => {
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
  }, [onToggleMovingMode]);

  return (
    <button
      ref={buttonRef}
      className="move-point-button"
      style={{
        position: "absolute",
        top: "20px",
        right: "320px",
        zIndex: "1000",
        padding: "8px 16px",
        backgroundColor: "#2196F3",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      포인트 이동
    </button>
  );
};

export default MoveButton;
