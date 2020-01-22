export interface LifxDevice {
  ip: string;
  label: string;
}

export type DiscoverCallback = (device: LifxDevice) => void
