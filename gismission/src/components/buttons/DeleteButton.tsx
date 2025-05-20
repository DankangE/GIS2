import React, { useEffect, useRef } from "react";

interface DeleteButtonProps {
  onToggleDeletingMode: {
    (isDeleting: boolean): void,
    reset?: (value: boolean) => void,
  };
}

const DeleteButton: React.FC<DeleteButtonProps> = ({
  onToggleDeletingMode,
}) => {
  const buttonRef = useRef < HTMLButtonElement > null;
  const isDeletingRef = useRef < boolean > false;

  // 버튼 상태 갱신 함수
  const updateButtonState = (isDeleting: boolean): void => {
    if (!buttonRef.current) return;

    isDeletingRef.current = isDeleting;

    if (isDeletingRef.current) {
      buttonRef.current.innerText = "삭제 취소";
      buttonRef.current.style.backgroundColor = "#d32f2f";
    } else {
      buttonRef.current.innerText = "포인트 삭제";
      buttonRef.current.style.backgroundColor = "#f44336";
    }
  };

  useEffect(() => {
    const button = buttonRef.current;

    const handleClick = (): void => {
      const newState = !isDeletingRef.current;
      updateButtonState(newState);

      // 상위 컴포넌트에 상태 변경 알림
      onToggleDeletingMode(newState);
    };

    // 콜백 함수 갱신
    onToggleDeletingMode.reset = (value: boolean): void => {
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
  }, [onToggleDeletingMode]);

  return (
    <button
      ref={buttonRef}
      className="delete-point-button"
      style={{
        position: "absolute",
        top: "20px",
        right: "180px",
        zIndex: "1000",
        padding: "8px 16px",
        backgroundColor: "#f44336",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      포인트 삭제
    </button>
  );
};

export default DeleteButton;
