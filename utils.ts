import { HomectlPlugin } from './plugins';
import { DeviceState, InternalDeviceState } from './types';
import tinycolor from '@ctrl/tinycolor';

export const mkDevicePath = <A>(plugin: HomectlPlugin<A>, deviceId: string) =>
  `integrations/${plugin.id}/${deviceId}`;

export const checkStateEq = (
  internal: InternalDeviceState,
  device: DeviceState,
): boolean => {
  if (internal.power !== device.power) return false;

  // checking for color string match before parsing,
  // also both can't be undefined after this
  if (internal.color === device.color) return true;

  const internalColor = tinycolor(internal.color).toHsv();
  // InternalDeviceState contains the original color, unmodified by brightness.
  // We need to apply brightness here in order to compare these
  internalColor.v *= internal.brightness ?? 1;

  const deviceColor = tinycolor(device.color).toHsv();

  if (Math.round(internalColor.h) !== Math.round(deviceColor.h)) return false;
  if (Math.round(internalColor.s) !== Math.round(deviceColor.s)) return false;
  if (Math.round(internalColor.v) !== Math.round(deviceColor.v)) return false;

  return true;
};
