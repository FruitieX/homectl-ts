import * as t from 'io-ts'
import { TinyColor } from '@ctrl/tinycolor'

import { PluginProps, throwDecoder, SceneConfig } from "../../types";
import { HomectlPlugin } from '../../plugins';

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
  knownLights: Array<string> = []

  constructor(props: PluginProps<Config>) {
    super(props, Config);
  }

  async register() {
    this.app.on('registerLight', (msg: unknown) => {
      const lightId = throwDecoder(t.string)(msg, "Unable to decode registerLight message")

      this.knownLights.push(lightId)
      this.log(`Discovered light "${lightId}"`)

      this.app.emit('registerDevice', `integrations/${this.id}/${lightId}`)
    })
  }

  async activateScene(sceneName: string) {
    // send scene switch msg to all lights in scene, get scene by sending scenes/somename msg
    const scene = await this.sendMsg(`scenes/${sceneName}`, SceneConfig)

    this.log(scene)
  }

  async handleMsg(path: string, payload: unknown) {
    const cmd = path

    switch (cmd) {
      case 'activateScene': {
        const scene = throwDecoder(t.string)(payload, "Unable to decode activateScene payload")

        this.activateScene(scene);
        break;
      }
      default: this.log(`Unknown cmd sent to lights integration: ${cmd}`)
    }
  }
}
