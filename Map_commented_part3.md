# Map.jsx - 지도 클릭 및 상호작용 처리

## 지도 클릭 이벤트 핸들러

```javascript
// 지도 클릭 이벤트 핸들러
const handleMapClick = (event) => {
  if (isMovingPointRef.current) return; // 이동 모드면 클릭 무시

  // 추가 모드일 때 클릭 처리
  if (isAddingPointRef.current) {
    const clickCoord = event.coordinate; // 클릭한 좌표(웹 메르카토르)
    const [lon, lat] = toLonLat(clickCoord); // 경위도로 변환

    // 새 포인트 객체 생성
    const newPoint = {
      objectId: nextObjectIdRef.current,
      name: `새 포인트`,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      rel_alt: 0,
      note: "",
    };

    // 동일한 objectId를 가진 Feature가 이미 존재하는지 확인
    const { source } = gcpLayerRef.current;
    const exists = source.getFeatures().some((f) => {
      const props = f.get("properties");
      return props && props.objectId === newPoint.objectId;
    });

    // 중복 ID면 다음 ID 사용
    if (exists) {
      nextObjectIdRef.current++;
      newPoint.objectId = nextObjectIdRef.current;
    }

    // 새 피처 생성 및 추가
    const newFeature = createPointFeature(newPoint);
    gcpSource.addFeature(newFeature);
    pointFeaturesRef.current.push(newFeature);
    nextObjectIdRef.current++; // 다음 ID 증가

    // 상위 컴포넌트에 포인트 추가 알림
    if (typeof handleMapPointAdded === "function") {
      handleMapPointAdded(newPoint);
    }

    // 추가 모드 비활성화
    isAddingPointRef.current = false;
    if (handleToggleAddingMode.reset) {
      handleToggleAddingMode.reset(false);
    }
    return;
  }

  // 삭제 모드일 때 클릭 처리
  if (isDeletingPointRef.current) {
    const clickPixel = map.getEventPixel(event.originalEvent);
    let closestFeature = null;

    // 클릭한 위치의 피처 찾기
    map.forEachFeatureAtPixel(clickPixel, (feature) => {
      closestFeature = feature;
      return true;
    });

    // 피처가 있으면 삭제
    if (closestFeature) {
      const featureProps = closestFeature.get("properties");
      const currentObjectId = featureProps.objectId;

      // 소스에서 피처 제거
      gcpSource.removeFeature(closestFeature);
      // 참조 배열에서도 제거
      pointFeaturesRef.current = pointFeaturesRef.current.filter(
        (feature) => feature !== closestFeature
      );

      // 상위 컴포넌트에 피처 삭제 알림
      if (typeof handleFeatureDeleted === "function") {
        handleFeatureDeleted(currentObjectId);
      }

      // 다음 피처 선택 처리
      if (typeof onFeatureSelect === "function") {
        const nextFeature = pointFeaturesRef.current.find(
          (feature) => feature.get("properties").objectId > currentObjectId
        );
        if (nextFeature) {
          onFeatureSelect(nextFeature.get("properties").objectId);
        }
      }

      // 삭제 모드 비활성화
      isDeletingPointRef.current = false;
      if (handleToggleDeletingMode.reset) {
        handleToggleDeletingMode.reset(false);
      }
    }
  }
};

// 지도에 클릭 이벤트 리스너 등록
map.on("click", handleMapClick);
```

## 선택 이벤트 처리

```javascript
// 선택 이벤트 리스너 등록
select.on("select", (e) => {
  if (e.selected && e.selected.length > 0) {
    const objectId = e.selected[0].get("properties").objectId;
    // 상위 컴포넌트에 피처 선택 알림
    if (typeof onFeatureSelect === "function") {
      onFeatureSelect(objectId);
    }
  }
});
```

## 임무 그리기 관련 함수

```javascript
// 임무 탭 드로우 시작
const startMissionDraw = () => {
  const map = mapRef.current;
  if (!map) return;
  const polygonSource = polygonSourceRef.current;

  // 기존 draw/snap 제거
  if (drawInteractionRef.current)
    map.removeInteraction(drawInteractionRef.current);
  if (snapInteractionRef.current)
    map.removeInteraction(snapInteractionRef.current);

  // 새 draw 생성 (선택한 타입으로)
  const draw = new Draw({
    source: polygonSource,
    type: drawType, // "Point", "LineString", "Circle", "Polygon"
  });
  drawInteractionRef.current = draw;
  map.addInteraction(draw);

  // snap 인터랙션 추가
  const snap = new Snap({ source: polygonSource });
  snapInteractionRef.current = snap;
  map.addInteraction(snap);

  // 하나 그려지면 draw 인터랙션만 제거
  draw.on("drawend", (event) => {
    setTimeout(() => {
      map.removeInteraction(draw);
      map.removeInteraction(snap);
    }, 100);

    // 그려진 피처 처리
    const feature = event.feature;
    const geometry = feature.getGeometry();

    // 다음 objectId 계산
    const nextId =
      missionData && Array.isArray(missionData.features)
        ? missionData.features.length + 1
        : 1;

    // GeoJSON 형식으로 변환
    const geojsonFormat = new GeoJSON();
    const geojsonObj = geojsonFormat.writeFeatureObject(feature);

    // 속성 설정
    geojsonObj.objectId = "feature" + nextId;
    geojsonObj.properties = {
      name: "",
      notes: "",
    };

    // 원본 feature에도 같은 속성 설정
    feature.set("objectId", "feature" + nextId);
    feature.set("name", "");
    feature.set("notes", "");

    // 상위 컴포넌트에 미션 피처 추가 알림
    if (typeof onMissionFeatureAdded === "function" && currentTab === 2) {
      onMissionFeatureAdded({
        objectId: "feature" + nextId,
        type: geometry.getType(),
        properties: {
          name: "",
          notes: "",
        },
        geometry: {
          type: geometry.getType(),
          coordinates:
            geometry.getType() === "Circle"
              ? geometry.getCenter() // Circle일 경우 중심점
              : geometry.getCoordinates(), // 다른 타입일 경우 좌표 배열
          radius: geometry.getType() === "Circle" ? geometry.getRadius() : null,
        },
      });
    }
  });
};

// 미션 모달 확인 버튼
const handleMissionModalConfirm = () => {
  setMissionModalOpen(false);
  startMissionDraw();
};
```

## 피처 하이라이트 및 패닝 - highlightFeatureAndPan 메서드

```javascript
highlightFeatureAndPan: (objectId) => {
  if (!objectId) return;

  // 임무탭이면 polygonSource에서 찾기
  if (currentTab === 2 && polygonSourceRef.current) {
    const features = polygonSourceRef.current.getFeatures();

    // 모든 feature 스타일 초기화
    features.forEach((feature) => {
      feature.setStyle(null);
      feature.changed();
    });

    // objectId로 feature 찾기
    const feature = features.find((f) => {
      const fid = f.get("objectId");
      const isEqual = String(fid) === String(objectId);
      return isEqual;
    });

    if (feature) {
      // geometry 타입에 따라 하이라이트 스타일 적용
      const geometry = feature.getGeometry();
      if (geometry) {
        const type = geometry.getType();

        // 타입별 스타일 설정
        let style = null;
        if (type === "Point") {
          style = new Style({
            image: new Circle({
              radius: 12,
              fill: new Fill({ color: "#fffde7" }),
              stroke: new Stroke({ color: "#ff9800", width: 5 }),
            }),
          });
        } else if (type === "LineString") {
          style = new Style({
            stroke: new Stroke({ color: "#ff9800", width: 6 }),
          });
        } else if (type === "Polygon") {
          style = new Style({
            fill: new Fill({ color: "rgba(255, 235, 59, 0.3)" }),
            stroke: new Stroke({ color: "#ff9800", width: 4 }),
          });
        } else if (type === "Circle") {
          style = new Style({
            fill: new Fill({ color: "rgba(255, 235, 59, 0.2)" }),
            stroke: new Stroke({ color: "#ff9800", width: 4 }),
          });
        }

        // 스타일 적용
        if (style) {
          feature.setStyle(style);
          feature.changed();
        }

        // 지오메트리 타입별 패닝 처리
        // 지도를 해당 피처로 부드럽게 이동
      }
    }
  }

  // GCP/이착륙 탭은 해당 레이어에서 포인트 찾아 하이라이트
  else {
    // 포인트 스타일 적용 및 패닝 처리
  }
};
```

## 꼭짓점 마커 업데이트 함수

```javascript
// 꼭짓점 마커 동기화 함수 (선택된 Feature만, 원은 제외)
function updateVertexMarkers() {
  const vertexSource = vertexSourceRef.current;
  const polygonSource = polygonSourceRef.current;
  if (!vertexSource || !polygonSource) return;

  vertexSource.clear(); // 기존 마커 제거

  if (!selectedFeatureId) return; // 선택된 피처가 없으면 종료

  // 선택된 피처 찾기
  const feature = polygonSource
    .getFeatures()
    .find((f) => (f.ol_uid || f.getId() || f.uid) === selectedFeatureId);

  if (!feature) return;

  const geom = feature.getGeometry();
  if (!geom) return;

  // 지오메트리 타입별 꼭짓점 좌표 추출
  let coordsArr = [];
  if (geom.getType() === "Point") {
    coordsArr = [geom.getCoordinates()];
  } else if (geom.getType() === "LineString") {
    coordsArr = geom.getCoordinates();
  } else if (geom.getType() === "Polygon") {
    coordsArr = geom.getCoordinates()[0] || [];
  }

  // 꼭짓점 마커 생성 및 추가
  if (!Array.isArray(coordsArr[0])) coordsArr = [coordsArr];
  coordsArr.forEach((coord) => {
    if (Array.isArray(coord) && typeof coord[0] === "number") {
      vertexSource.addFeature(new Feature(new Point(coord)));
    }
  });
}
```
