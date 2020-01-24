import * as t from 'io-ts';

import { PluginProps, throwDecoder, DeviceCommand } from '../../types';
import { HomectlPlugin } from '../../plugins';
import { LifxServer } from './server';
import { LifxDevice } from './types';

const Config = t.type({
  networkInterface: t.string,
});
type Config = t.TypeOf<typeof Config>;

/**
 * LIFX plugin
 *
 * Makes LIFX bulbs available as homectl devices.
 */

export default class LifxPlugin extends HomectlPlugin<Config> {
  server: LifxServer;
  devices: { [name: string]: LifxDevice };

  constructor(props: PluginProps<Config>) {
    super(props, Config);
    this.server = new LifxServer(this.config.networkInterface);
    this.devices = {};
  }

  async register() {
    await this.server.register();
  }

  start = async () => {
    this.server.discover(device => {
      if (!this.devices[device.label]) {
        this.app.emit(
          'registerDevice',
          `integrations/${this.id}/${device.label}`,
        );
      }

      this.devices[device.label] = device;

      this.sendMsg('devices/discoveredState', t.unknown, {
        path: `devices/${this.id}/${device.label}`,
        state: device.state,
      });
    });
  };

  async handleMsg(path: string, payload: unknown) {
    const cmds = throwDecoder(t.array(DeviceCommand))(
      payload,
      'Unable to decode batch light update',
    );

    for (const cmd of cmds) {
      const [subsystem, integration, label] = cmd.path.split('/');
      const device = this.devices[label];

      if (!device) {
        return console.error(`Cannot find lifx device with label ${label}!`);
      }

      this.server.setLightColor(device.ip, cmd);
    }
  }
}
