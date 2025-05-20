declare module 'ol-ext/interaction/Transform' {
  import { Interaction } from 'ol/interaction';
  import { Feature } from 'ol';
  import { Geometry } from 'ol/geom';

  export default class TransformInteraction extends Interaction {
    constructor(options?: {
      features?: Feature<Geometry>[];
      translate?: boolean;
      rotate?: boolean;
      scale?: boolean;
      stretch?: boolean;
    });
  }
} 