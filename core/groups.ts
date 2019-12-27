import * as t from 'io-ts'
import minimatch from 'minimatch';

import { PluginProps, GroupsConfig, throwDecoder } from "../types";
import { HomectlPlugin } from '../plugins';

const Config = GroupsConfig
type Config = t.TypeOf<typeof Config>

/**
 * Groups plugin
 * 
 * Keeps track of registered devices and responds to messages with a list of known devices in given group.
 */

export default class GroupsPlugin extends HomectlPlugin<Config> {
  groups: GroupsConfig = {}
  knownDevices: Array<string> = []

  constructor(props: PluginProps<Config>) {
    super(props, Config);
  }

  async register() {
    this.groups = this.config

    this.app.on('registerDevice', (msg: unknown) => {
      const device = throwDecoder(t.string)(msg, "Unable to decode registerDevice message")

      this.knownDevices.push(device)
    })
  }

  async handleMsg(path: string, payload: unknown) {
    const groupName = path

    const group = this.groups[groupName]
    if (!group) return this.log(`No group found with name ${groupName}, dropping message: ${path} ${payload}`)

    const devices = this.knownDevices.filter((...deviceArgs) =>
      // see if we can find any path that matches to this device
      group.devices.find(path =>
        minimatch.filter(path)(...deviceArgs)
      )
    )

    return devices
  }
}