export type TrendPoint = {
  date: string;
  highest: number;
  high: number;
  medium: number;
  low: number;
  lowest: number;
};

export type TeamKey = "api" | "legacy" | "react";

// CombinedTrendPoint consumer mapping:
// - api: API team consumer metrics
// - legacy: Legacy frontend team consumer metrics
// - react: React frontend team consumer metrics
export type CombinedTrendPoint = {
  date: string;
  api: TrendPoint;
  legacy: TrendPoint;
  react: TrendPoint;
};

// All consumers read from the same snapshot.json payload via this shape.
export type BacklogSnapshot = {
  // Additive metadata for snapshot lifecycle/debugging.
  schemaVersion: number;
  updatedAt: string;
  source: {
    mode: string;
    syncedAt: string;
    note: string;
  };
  combinedPoints: CombinedTrendPoint[];
};
