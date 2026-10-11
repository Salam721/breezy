/** [longitude, latitude], the GeoJSON (RFC 7946) order. */
export type Position = [number, number];
export type Ring = Position[];

export interface PlumeFeature {
  type: 'Feature';
  properties: {
    sensor_id: number;
    location_id: number;
    pm25: number;
    observed_at: string;
  };
  geometry: { type: 'Polygon'; coordinates: Ring[] };
}

/** The plumes.json document published by the pipeline (design.md section 2). */
export interface PlumeFile {
  type: 'FeatureCollection';
  generated_at: string; // ISO UTC; when the file was built; drives the staleness rule
  data_as_of?: string | null; // newest sensor reading behind the file (sensors report roughly hourly)
  sensors_used?: number;
  wind?: { from_deg: number; speed_mph: number; source?: string };
  config?: Record<string, unknown>;
  features: PlumeFeature[];
}

export type AppStatus = 'SAFE' | 'IN_PLUME' | 'STALE';

export interface SurveyAnswers {
  [question: string]: string | number | boolean;
}

export interface Profile {
  baselineSurvey: SurveyAnswers;
  createdAt: string;
}

export type ImpactEventType = 'inhaler' | 'closed_windows' | 'rerouted';

export interface ImpactEvent {
  type: ImpactEventType;
  at: string; // ISO
}

export interface ImpactSummary {
  inhaler: number;
  closed_windows: number;
  rerouted: number;
  total: number;
  lastAt: string | null;
}
