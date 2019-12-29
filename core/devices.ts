import * as t from 'io-ts'
import { TinyColor } from '@ctrl/tinycolor'

import { PluginProps, throwDecoder, SceneCommand } from "../types";
import { HomectlPlugin } from '../plugins';
import { groupBy } from 'fp-ts/lib/NonEmptyArray';

const Config = t.type({

})
type Config = t.TypeOf<typeof Config>

interface DeviceState {
  power: boolean;
  color?: TinyColor
  brightness?: number;
}

interface State {
  devices: { [deviceId: string]: DeviceState }
}

/**
 * Devices plugin
 * 
 * The devices plugin provides a unified way of controlling devices of different
 * brands / gateway types. It also maintains a "wished" state of devices, so
 * even if a gateway API request fails we can retry later to restore the real
 * device states to match the wished states.
 */

export default class DevicesPlugin extends HomectlPlugin<Config> {
  state: State = { devices: {} }
  knownDevices: Array<string> = []

  constructor(props: PluginProps<Config>) {
    super(props, Config);
  }

  async register() {
    this.app.on('registerDevice', (msg: unknown) => {
      const path = throwDecoder(t.string)(msg, "Unable to decode registerDevice message")

      // don't handle already known devices
      if (path.startsWith('devices/')) return

      this.knownDevices.push(path)
      this.log(`Discovered device "${path}"`)

      const [subsystem, ...fwdPath] = path.split('/')
      this.app.emit('registerDevice', `devices/${fwdPath.join('/')}`)
    })
  }

  async activateScene(sceneName: string) {
    // send scene switch msg to all devices in scene, get scene by sending scenes/somename msg
    const scene = await this.sendMsg(`scenes/getScene`, t.array(SceneCommand), sceneName)

    if (!scene) {
      this.log(`No scene found with name ${sceneName}`)
      return
    }

    this.log(`Activating scene ${sceneName}`)

    const groupedSceneCmds = groupBy((cmd: SceneCommand) => {
      const [subsystem, plugin] = cmd.path.split('/')
      return `${subsystem}/${plugin}`;
    })(scene)

    for (const path in groupedSceneCmds) {
      const group = groupedSceneCmds[path]
      this.sendMsg(path, t.unknown, group)
    }
  }

  async handleMsg(path: string, payload: unknown) {
    const cmd = path

    switch (cmd) {
      case 'activateScene': {
        const scene = throwDecoder(t.string)(payload, "Unable to decode activateScene payload")

        this.activateScene(scene);
        break;
      }
      // relay unknown commands to integrations/*
      default: await this.sendMsg(`integrations/${path}`, t.unknown, payload)
    }
  }
}
