import { HomectlPlugin } from './plugins';
import { DeviceState, InternalDeviceState } from './types';
import tinycolor from '@ctrl/tinycolor';

export const mkDevicePath = <A>(plugin: HomectlPlugin<A>, deviceId: string) =>
  `integrations/${plugin.id}/${deviceId}`;

export const checkStateEq = (
  internal: InternalDeviceState,
  device: DeviceState,
): boolean => {
  // if power states mismatch, return false
  if (internal.power !== device.power) return false;

  // if power states match and internal power is false, we don't care about color
  if (internal.power === false) return true;

  // checking for color string match before parsing,
  // also both can't be undefined after this
  if (internal.color === device.color) return true;

  // if device color is undefined, assume device does not support color - skip
  // color checks
  if (device.color === undefined) return true;

  const internalColor = tinycolor(internal.color).toHsv();
  // InternalDeviceState contains the original color, unmodified by brightness.
  // We need to apply brightness here in order to compare these
  internalColor.v *= internal.brightness ?? 1;

  const deviceColor = tinycolor(device.color).toHsv();

  if (Math.round(internalColor.h) !== Math.round(deviceColor.h)) return false;
  if (Math.round(internalColor.s * 100) !== Math.round(deviceColor.s * 100))
    return false;
  if (Math.round(internalColor.v * 100) !== Math.round(deviceColor.v * 100))
    return false;

  return true;
};

export const removeUndefined = <T>(obj: T): T => {
  const copy = { ...obj };

  Object.keys(copy).forEach(
    key => (copy as any)[key] === undefined && delete (copy as any)[key],
  );

  return copy;
};
