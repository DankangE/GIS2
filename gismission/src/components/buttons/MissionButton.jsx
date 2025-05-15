// gismission/src/components/buttons/MissionButton.jsx
import React from "react";
import Button from "@mui/material/Button";

const MissionButton = ({ onClick }) => (
  <Button variant="contained" color="primary" onClick={onClick}>
    추가
  </Button>
);

export default MissionButton;
