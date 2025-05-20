// gismission/src/components/buttons/MissionButton.jsx
import React from "react";
import Button from "@mui/material/Button";

interface MissionButtonProps {
  onClick: () => void;
}

const MissionButton: React.FC<MissionButtonProps> = ({ onClick }) => (
  <Button variant="contained" color="primary" onClick={onClick}>
    추가
  </Button>
);

export default MissionButton;
