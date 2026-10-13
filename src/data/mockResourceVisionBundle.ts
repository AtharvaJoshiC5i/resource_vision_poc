import capacityConfigData from "./capacityConfig.json";
import famstackData from "./famstack.json";
import projectTrackData from "./projectTrack.json";
import zinghrData from "./zinghr.json";

import type { CapacityConfigRecord } from "../types/capacity";
import type { FamstackRecord } from "../types/famstack";
import type { ProjectTrackRecord } from "../types/projectTrack";
import type { ZingHREmployee } from "../types/zinghr";

import { buildResourceVisionData } from "../services/buildResourceVisionData";

const capacityConfig = capacityConfigData as CapacityConfigRecord[];
const famstack = famstackData as FamstackRecord[];
const projectTrack = projectTrackData as ProjectTrackRecord[];
const zinghr = zinghrData as ZingHREmployee[];

export const mockResourceVisionBundle = buildResourceVisionData({
  capacityConfig,
  famstack,
  projectTrack,
  zinghr,
});
