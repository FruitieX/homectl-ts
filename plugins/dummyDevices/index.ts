import * as t from 'io-ts';
import R from 'ramda';

import { PluginProps } from '../../types';
import { HomectlPlugin } from '../../plugins';
import { mkDevicePath } from '../../utils';

const Config = t.type({
  devices: t.array(t.string),
});
type Config = t.TypeOf<typeof Config>;

interface Device {
  power: boolean;

  [key: string]: unknown;
}

interface State {
  devices: {
    [name: string]: Device;
  };
}

/**
 * Dummy devices plugin
 *
 * Registers dummy devices, logs state changes
 */

export default class DummyDevicesPlugin extends HomectlPlugin<Config> {
  state: State;

  constructor(props: PluginProps<Config>) {
    super(props, Config);

    this.state = {
      devices: R.zipObj(
        this.config.devices,
        R.map(_ => ({ power: false }), this.config.devices),
      ),
    };
  }

  async register() {
    this.log('Registered dummy devices plugin');
  }

  async start() {
    for (const device of this.config.devices) {
      const initialState = {
        path: mkDevicePath(this, device),
        state: {
          power: true,
        },
      };
      this.sendMsg('devices/discoveredState', t.unknown, initialState);
    }
  }

  async handleMsg(path: string, payload: unknown) {
    this.log('Got msg', path, payload);
  }
}
