import * as t from 'io-ts'
import axios, { Method } from 'axios'

import { PluginProps, throwDecoder, DeviceCommand } from "../../types";
import { HomectlPlugin } from '../../plugins';
import { map } from 'fp-ts/lib/Record';
import { findIndex } from 'ramda';
import { findFirst } from 'fp-ts/lib/Array';
import { pipe } from 'fp-ts/lib/pipeable';
import { fold } from 'fp-ts/lib/Option';
import tinycolor from '@ctrl/tinycolor';
import { LifxServer } from './server';
import { LifxDevice } from './types';

const Config = t.type({
  networkInterface: t.string
})
type Config = t.TypeOf<typeof Config>

/**
 * LIFX plugin
 * 
 * Makes LIFX bulbs available as homectl devices.
 */

export default class LifxPlugin extends HomectlPlugin<Config> {
  server: LifxServer;
  devices: { [name: string]: LifxDevice }

  constructor(props: PluginProps<Config>) {
    super(props, Config);
    this.server = new LifxServer(this.config.networkInterface)
    this.devices = {}
  }

  async register() {
    await this.server.register()
  }

  start = async () => {
    this.server.discover(device => {
      this.devices[device.label] = device
      this.app.emit('registerDevice', `integrations/${this.id}/${device.label}`)
    })
  }

  async handleMsg(path: string, payload: unknown) {
    const cmds = throwDecoder(t.array(DeviceCommand))(payload, "Unable to decode batch light update")

    for (const cmd of cmds) {
      const [subsystem, integration, label] = cmd.path.split('/')
      const device = this.devices[label]

      if (!device) { return console.error(`Cannot find lifx device with label ${label}!`) }

      this.server.setLightColor(device.ip, tinycolor(cmd.color), cmd.brightness, cmd.transition)
      console.log(cmd);
    }
  }
}

