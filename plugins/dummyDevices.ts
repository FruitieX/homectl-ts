import * as t from 'io-ts'
import { PluginProps } from "../types";
import R from 'ramda';
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
    super(props, Config.decode(props.config));

    this.state = {
      devices: R.zipObj(this.config.devices, R.map(_ => ({ power: false }), this.config.devices))
    }
  }

  async register() {
    console.log('registered dummy devices plugin')
    this.app.on('start', () => {
      console.log(this.state)
    })
  }

  async handleMsg(path: string, payload: unknown) {
    console.log('got msg', path, payload)
  }
}