import { TinyColor } from "@ctrl/tinycolor";

export interface LifxDevice {
  ip: string;
  label: string;
  state: {
    color: TinyColor;
    power: boolean;
  }
}

export type DiscoverCallback = (device: LifxDevice) => void
