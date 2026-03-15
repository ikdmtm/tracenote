import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { openDatabaseSync } from "expo-sqlite";

import { DB_NAME } from "@/core/storage/db";
import { LOCATION } from "@/core/constants";

export const BG_LOCATION_TASK = "tracenote-bg-location";

type LocationTaskBody = {
  locations: Location.LocationObject[];
  error: TaskManager.TaskManagerError | null;
};

TaskManager.defineTask<LocationTaskBody>(
  BG_LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      console.error("[BG Location] Task error:", error.message);
      return;
    }

    const { locations } = data;
    if (!locations || locations.length === 0) return;

    try {
      const db = openDatabaseSync(DB_NAME);

      for (const loc of locations) {
        db.runSync(
          "INSERT INTO raw_events (ts, lat, lng, acc, source) VALUES (?, ?, ?, ?, ?)",
          [
            Math.floor(loc.timestamp),
            loc.coords.latitude,
            loc.coords.longitude,
            loc.coords.accuracy ?? -1,
            "background",
          ],
        );
      }
    } catch (e) {
      console.error("[BG Location] DB write error:", e);
    }
  },
);

export async function startBackgroundLocation(): Promise<boolean> {
  const isStarted = await Location.hasStartedLocationUpdatesAsync(
    BG_LOCATION_TASK,
  ).catch(() => false);

  if (isStarted) return true;

  try {
    await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: LOCATION.TIME_INTERVAL_MS,
      distanceInterval: LOCATION.DISTANCE_FILTER_M,
      deferredUpdatesInterval: LOCATION.TIME_INTERVAL_MS,
      showsBackgroundLocationIndicator: false,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
    });
    return true;
  } catch (e) {
    console.error("[BG Location] Start failed:", e);
    return false;
  }
}

export async function stopBackgroundLocation(): Promise<void> {
  const isStarted = await Location.hasStartedLocationUpdatesAsync(
    BG_LOCATION_TASK,
  ).catch(() => false);

  if (isStarted) {
    await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
  }
}
