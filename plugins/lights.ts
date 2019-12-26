import * as t from 'io-ts'
import { PluginProps } from "../types";
import { HomectlPlugin } from '../plugins';
import { TinyColor } from '@ctrl/tinycolor'

const Config = t.type({
})
type Config = t.TypeOf<typeof Config>

interface LightState {
  power: boolean;
  color: TinyColor
  brightness: number;
}

interface State {
  lights: { [lightId: string]: LightState }
}

/**
 * Lights plugin
 * 
 * The lights plugin provides a unified way of controlling lights of different
 * brands / gateway types. It also maintains a "wished" state of lights, so
 * even if a gateway API request fails we can retry later to restore the real
 * light states to match the wished states.
 */

export default class LightsPlugin extends HomectlPlugin<Config> {
  state: State = { lights: {} }

  constructor(props: PluginProps<Config>) {
    super(props, Config);
  }

  async register() {
  }

  activateScene(scene: string) {
    // send scene switch msg to all lights in scene, get scene by sending scenes/somename msg
  }

  async handleMsg(path: string, payload: unknown) {
    const [cmd, ...lightPath] = path.split('/')

    const light = lightPath.join('/')

    switch (cmd) {
      case 'activateScene': {
        // this.activateScene();
        break;
      }
      default: this.log(`Unknown cmd sent to lights integration: ${cmd}`)
    }
  }
}
