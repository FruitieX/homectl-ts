import * as t from 'io-ts';
import minimatch from 'minimatch';

import {
  PluginProps,
  GroupsConfig,
  throwDecoder,
  InternalDeviceStates,
} from '../types';
import { HomectlPlugin } from '../plugins';

const Config = GroupsConfig;
type Config = t.TypeOf<typeof Config>;

/**
 * Groups plugin
 *
 * Keeps track of registered devices and responds to messages with a list of known devices in given group.
 */

export default class GroupsPlugin extends HomectlPlugin<Config> {
  groups: GroupsConfig = {};

  constructor(props: PluginProps<Config>) {
    super(props, Config);

    this.groups = this.config;
  }

  async handleMsg(path: string, payload: unknown) {
    const groupName = path;

    const allDevices = await this.sendMsg(
      'devices/getDevices',
      InternalDeviceStates,
    );

    const group = this.groups[groupName];
    if (!group)
      return this.log(
        `No group found with name ${groupName}, dropping message: ${path} ${payload}`,
      );

    const matchingPaths = Object.keys(allDevices).filter((...deviceArgs) =>
      // see if we can find any path that matches to this device
      group.devices.find(path => minimatch.filter(path)(...deviceArgs)),
    );

    const groupDevices = Object.fromEntries(
      Object.entries(allDevices).filter(([path]) =>
        matchingPaths.includes(path),
      ),
    );

    return groupDevices;
  }
}
