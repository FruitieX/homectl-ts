import { HomectlPlugin } from './plugins';

export const mkDevicePath = <A>(plugin: HomectlPlugin<A>, deviceId: string) =>
  `integrations/${plugin.id}/${deviceId}`;
