import { DeviceState } from "../../types";

export interface LifxDevice {
  ip: string;
  label: string;
  state: DeviceState;
}

export type DiscoverCallback = (device: LifxDevice) => void
