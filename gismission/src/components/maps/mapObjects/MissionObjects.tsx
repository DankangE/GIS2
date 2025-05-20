import { useEffect } from "react";
import Feature from "ol/Feature";
import { Point, LineString, Polygon, Circle as OlCircle } from "ol/geom";
import Map from "ol/Map";
import VectorSource from "ol/source/Vector";

interface MissionObjectsProps {
  map: Map;
  isActive: boolean;
  missionData: {
    features: Array<{
      geometry: {
        type: 'Point' | 'LineString' | 'Polygon' | 'Circle';
        coordinates: number[];
        radius?: number;
      };
      properties?: Record<string, any>;
      objectId?: string;
    }>;
  };
  polygonSource: VectorSource;
}

const MissionObjects: React.FC<MissionObjectsProps> = ({ map, isActive, missionData, polygonSource }) => {
  useEffect(() => {
    if (missionData && missionData.features && isActive && polygonSource) {
      polygonSource.clear();
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

        const olFeature = new Feature({ geometry });
        if (feature.properties) {
          olFeature.setProperties({ properties: feature.properties });
        }
        olFeature.set(
          "objectId",
          feature.objectId || `feature_${Date.now()}_${Math.random()}`
        );
        polygonSource.addFeature(olFeature);
      });
    }
  }, [missionData, isActive, polygonSource]);

  return null;
};

export default MissionObjects; 