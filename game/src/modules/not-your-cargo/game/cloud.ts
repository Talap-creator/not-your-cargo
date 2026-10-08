// Cloud copy of the progress in the player's iDos account (user custom data, Private key "nyc_save",
// registered in the Title config). Local storage stays the fast path; the cloud copy makes progress
// follow the account across devices and the site's partitioned frame. Merge rule: save.ts mergeSaves.
import type { IDosGamesClient } from "@idosgames/core";
import { mergeSaves, parseSave, sameProgress, type SaveData } from "./save";

export const CLOUD_KEY = "nyc_save";

export class CloudSave {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private last: SaveData | null = null;
  status: "idle" | "synced" | "error" = "idle";

  constructor(private client: IDosGamesClient) {}

  /** Read the cloud copy and merge it into the local save. Never throws; returns the merged save. */
  async pull(local: SaveData): Promise<SaveData> {
    try {
      const r = await this.client.userCustomData.getMyUserCustomData();
      if (!r.ok) {
        this.status = "error";
        return local;
      }
      const raw = r.data.Private?.[CLOUD_KEY]?.Value;
      const cloud = raw ? parseSave(JSON.parse(raw)) : null;
      const merged = cloud ? mergeSaves(local, cloud) : local;
      this.last = cloud;
      this.status = "synced";
      // the cloud is behind (first sync, or progress made offline): push the merge back
      if (!cloud || !sameProgress(cloud, merged)) this.push(merged, 0);
      return merged;
    } catch {
      this.status = "error";
      return local;
    }
  }

  /** Debounced write of the progress (device preferences go along, but are never taken from the cloud). */
  push(save: SaveData, delayMs = 1500): void {
    if (this.last && sameProgress(this.last, save)) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.client.userCustomData
        .setPrivateData(CLOUD_KEY, JSON.stringify(save))
        .then((r) => {
          this.status = r.ok ? "synced" : "error";
          if (r.ok) this.last = save;
        })
        .catch(() => (this.status = "error"));
    }, delayMs);
  }
}
