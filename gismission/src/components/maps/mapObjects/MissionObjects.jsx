import React, { useState, useEffect } from "react";
import { Map } from "ol";
import Draw from "ol/interaction/Draw";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import { Modal, Button, Select } from "antd";
import { PlusOutlined } from "@ant-design/icons";

const { Option } = Select;

const MissionObjects = ({ map, isActive }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [drawInteraction, setDrawInteraction] = useState(null);

  // 벡터 소스와 레이어 생성
  const vectorSource = new VectorSource();
  const vectorLayer = new VectorLayer({
    source: vectorSource,
    visible: false, // 초기에는 숨김
  });

  useEffect(() => {
    if (map) {
      map.addLayer(vectorLayer);
    }
  }, [map]);

  // 탭 활성화 상태에 따라 레이어 표시/숨김 처리
  useEffect(() => {
    if (vectorLayer) {
      vectorLayer.setVisible(isActive);

      // 탭이 비활성화되면 그리기 인터랙션 제거
      if (!isActive && drawInteraction) {
        map.removeInteraction(drawInteraction);
        setDrawInteraction(null);
      }
    }
  }, [isActive, map, drawInteraction]);

  const handleAddClick = () => {
    setIsModalVisible(true);
  };

  const handleTypeSelect = (value) => {
    setSelectedType(value);
    setIsModalVisible(false);
    startDrawing(value);
  };

  const startDrawing = (type) => {
    // 기존 draw interaction 제거
    if (drawInteraction) {
      map.removeInteraction(drawInteraction);
    }

    // 새로운 draw interaction 생성
    const draw = new Draw({
      source: vectorSource,
      type: type,
    });

    map.addInteraction(draw);
    setDrawInteraction(draw);
  };

  // 탭이 비활성화된 경우 컴포넌트를 렌더링하지 않음
  if (!isActive) {
    return null;
  }

  return (
    <div>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleAddClick}
        style={{ margin: "10px" }}
      >
        추가
      </Button>

      <Modal
        title="객체 타입 선택"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Select
          style={{ width: "100%" }}
          placeholder="객체 타입을 선택하세요"
          onChange={handleTypeSelect}
        >
          <Option value="Point">점</Option>
          <Option value="LineString">선</Option>
          <Option value="Circle">원</Option>
          <Option value="Polygon">폴리곤</Option>
        </Select>
      </Modal>
    </div>
  );
};

export default MissionObjects;
