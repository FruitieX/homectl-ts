import * as t from 'io-ts';

import {
  PluginProps,
  throwDecoder,
  DeviceCommand,
  DeviceCommands,
  DeviceState,
  DiscoveredState,
  InternalDeviceStates,
  InternalDeviceState,
} from '../types';
import { HomectlPlugin } from '../plugins';
import { groupBy } from 'fp-ts/lib/NonEmptyArray';
import tinycolor from '@ctrl/tinycolor';

const Config = t.type({});
type Config = t.TypeOf<typeof Config>;

interface State {
  devices: InternalDeviceStates;
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
  state: State = { devices: {} };

  constructor(props: PluginProps<Config>) {
    super(props, Config);
  }

  registerDevice(path: string, state: DeviceState) {
    const device: InternalDeviceState = {
      brightness: 1,
      scene: undefined,
      sceneActivationTime: undefined,
      transition: undefined,
      ...state,
    };

    this.state.devices[path] = device;
    this.log(`Registered device "${path}"`);

    return device;
  }

  async activateScene(sceneName: string) {
    // send scene switch msg to all devices in scene, get scene by sending scenes/somename msg
    const scene = await this.sendMsg(
      `scenes/getScene`,
      DeviceCommands,
      sceneName,
    );

    if (!scene) {
      this.log(`No scene found with name ${sceneName}`);
      return;
    }

    this.log(`Activating scene ${sceneName}`);
    this.applyDeviceCmds(scene, sceneName);
  }

  async applyDeviceCmds(cmds: DeviceCommands, sceneName?: string) {
    for (const cmd of cmds) {
      const sceneProps =
        sceneName === undefined
          ? {}
          : {
              scene: sceneName,
              sceneActivationTime: Date.now(),
              brightness: 1, // reset brightness to 1 unless scene specifies otherwise
            };

      this.state.devices[cmd.path] = {
        ...this.state.devices[cmd.path],
        transition: 500, // default transition time, cmd can override
        ...sceneProps,
        ...cmd,
      };
    }

    const groupedSceneCmds = groupBy((cmd: DeviceCommand) => {
      const [subsystem, plugin] = cmd.path.split('/');
      return `${subsystem}/${plugin}`;
    })(cmds);

    for (const path in groupedSceneCmds) {
      const group = groupedSceneCmds[path];
      this.sendMsg(path, t.unknown, group);
    }
  }

  async discoveredState(path: string, state: DeviceState) {
    let match = this.state.devices[path];

    if (!match) {
      match = this.registerDevice(path, state);
    }

    // if (match) console.log('found match', match);
    // console.log(path, state, this.state);
  }

  // TODO: this doesn't handle canceling the transition when releasing the dimmer button
  // and always drops the brightness by given rate
  async adjustBrightness(unexpandedPath: string, rate: number) {
    const paths = await this.expandPath(unexpandedPath);

    const cmds: DeviceCommands = paths.map(path => {
      const prevState = this.state.devices[path];
      const cmd = {
        path,
        brightness: 1,
        ...prevState,
        transition: 1000,
      };

      return {
        ...cmd,
        brightness: Math.min(2, Math.max(0, (cmd.brightness ?? 1) + rate)),
      };
    });

    await this.applyDeviceCmds(cmds);
  }

  async expandPath(path: string) {
    if (!path.startsWith('groups/')) return [path];

    const devices = await this.sendMsg(path, InternalDeviceStates);

    return Object.keys(devices);
  }

  async handleMsg(path: string, payload: unknown) {
    const cmd = path;

    switch (cmd) {
      case 'activateScene': {
        const scene = throwDecoder(t.string)(
          payload,
          'Unable to decode activateScene payload',
        );

        this.activateScene(scene);
        break;
      }
      case 'adjustBrightness': {
        const cmd = throwDecoder(t.tuple([t.string, t.string]))(
          payload,
          'Unable to decode adjustBrightness payload',
        );
        const [path, rate] = cmd;

        this.adjustBrightness(path, parseFloat(rate));
        break;
      }
      case 'discoveredState': {
        const { path, state } = throwDecoder(DiscoveredState)(
          payload,
          'Unable to decode discoveredState payload',
        );

        this.discoveredState(path, state);
        break;
      }
      case 'getDevices': {
        return this.state.devices;
      }
      // relay unknown commands to integrations/*
      default:
        await this.sendMsg(`integrations/${path}`, t.unknown, payload);
    }
  }
}
