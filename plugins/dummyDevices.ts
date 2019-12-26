import * as t from 'io-ts'
import R from 'ramda';

import { PluginProps } from "../types";
import { HomectlPlugin } from '../plugins';

const Config = t.type({
  devices: t.array(t.string)
})
type Config = t.TypeOf<typeof Config>

type Device = {
  power: boolean
}

interface State {
  devices: {
    [name: string]: Device
  }
}

/**
 * Dummy devices plugin
 * 
 * Registers dummy devices, logs state changes
 */

export default class DummyDevicesPlugin extends HomectlPlugin<Config> {
  state: State

  constructor(props: PluginProps<Config>) {
    super(props, Config);

    this.state = {
      devices: R.zipObj(this.config.devices, R.map(_ => ({ power: false }), this.config.devices))
    }
  }

  async register() {
    this.log('Registered dummy devices plugin')
    this.app.on('start', () => {
      this.log(this.state)
    })
  }

  async start() {
    for (const device in this.config.devices) {
      this.app.emit('registerDevice', `integrations/${this.id}/${device}`)
      this.app.emit('registerLight', `${this.id}/${device}`)
    }
  }

  async handleMsg(path: string, payload: unknown) {
    this.log('Got msg', path, payload)
  }
}