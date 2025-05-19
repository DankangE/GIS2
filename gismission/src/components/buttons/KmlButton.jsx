import React from "react";
import Button from "@mui/material/Button";

const KmlButton = ({ onClick }) => (
  <Button variant="contained" color="success" onClick={onClick}>
    KML 내보내기
  </Button>
);

export default KmlButton;
