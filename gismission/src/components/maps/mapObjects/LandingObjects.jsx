import { Feature } from "ol";
import { Point } from "ol/geom";
import { Style, Text, Fill, Stroke, Circle } from "ol/style";
import { fromLonLat } from "ol/proj";
import { Vector as VectorSource } from "ol/source";
import { Vector as VectorLayer } from "ol/layer";

// 포인트 특성 생성 함수
export const createPointFeature = (point) => {
  const feature = new Feature({
    geometry: new Point(fromLonLat([point.lon, point.lat])),
    name: point.name,
    properties: point, // 원본 데이터도 속성으로 저장
  });

  // 포인트에 스타일 적용
  feature.setStyle(
    new Style({
      image: new Circle({
        radius: 15,
        fill: new Fill({ color: "blue" }),
        stroke: new Stroke({ color: "white", width: 1.5 }),
      }),
      text: new Text({
        text: point.name,
        offsetY: -12,
        font: "10px sans-serif",
        fill: new Fill({ color: "black" }),
        stroke: new Stroke({ color: "white", width: 2 }),
      }),
    })
  );

  return feature;
};

// 이착륙 데이터를 로드하여 모든 포인트 생성
export const createLandingPointsLayer = () => {
  const vectorSource = new VectorSource();
  const vectorLayer = new VectorLayer({
    source: vectorSource,
    style: new Style({
      image: new Circle({
        radius: 5,
        fill: new Fill({ color: "blue" }),
        stroke: new Stroke({ color: "white", width: 1.5 }),
      }),
    }),
    name: "landingLayer",
    type: "vector",
  });

  return {
    vectorLayer, // 레이어 반환
    vectorSource, // 소스 반환
    createPointFeature, // 포인트 생성 함수 노출
    loadLandingData: async () => {
      try {
        const response = await fetch("/jsondatas/landingData.json");
        const data = await response.json();

        // 모든 포인트 피처 생성 및 소스에 추가
        const features = data.map((point) => createPointFeature(point));
        vectorSource.addFeatures(features);

        console.log(`${features.length}개의 이착륙 포인트가 로드되었습니다.`);
        return features;
      } catch (error) {
        console.error("이착륙 데이터 로드 오류:", error);
        return [];
      }
    },
  };
};
