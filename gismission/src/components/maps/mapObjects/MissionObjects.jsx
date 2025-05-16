import { useEffect } from "react";
import Feature from "ol/Feature";
import { Point, LineString, Polygon, Circle as OlCircle } from "ol/geom";

const MissionObjects = ({ map, isActive, missionData, polygonSource }) => {
  useEffect(() => {
    if (missionData && missionData.features && isActive && polygonSource) {
      missionData.features.forEach((feature) => {
        let geometry;
        const coordinates = feature.geometry?.coordinates;
        if (!coordinates) return;
        switch (feature.geometry.type) {
          case "Point":
            geometry = new Point(coordinates);
            break;
          case "LineString":
            geometry = new LineString(coordinates);
            break;
          case "Polygon":
            geometry = new Polygon(coordinates);
            break;
          case "Circle":
            geometry = new OlCircle(
              coordinates,
              feature.geometry.radius || 1000
            );
            break;
          default:
            return;
        }

        const existingFeatures = polygonSource.getFeatures();
        const isDuplicate = existingFeatures.some((f) => {
          const geom = f.getGeometry();
          if (!geom || geom.getType() !== geometry.getType()) return false;

          try {
            const coords1 = JSON.stringify(geom.getCoordinates());
            const coords2 = JSON.stringify(geometry.getCoordinates());
            return coords1 === coords2;
          } catch (e) {
            return false;
          }
        });

        if (!isDuplicate) {
          const olFeature = new Feature({ geometry });
          if (feature.properties) {
            olFeature.setProperties({ properties: feature.properties });
          }
          olFeature.set(
            "objectId",
            feature.objectId || `feature_${Date.now()}_${Math.random()}`
          );
          polygonSource.addFeature(olFeature);
        }
      });
    }
  }, [missionData, isActive, polygonSource]);

  return null;
};

export default MissionObjects;
