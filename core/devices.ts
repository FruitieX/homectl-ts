import * as t from 'io-ts';

import {
  PluginProps,
  throwDecoder,
  DeviceCommand,
  DeviceCommands,
  DeviceState,
  InternalDeviceStates,
  InternalDeviceState,
  InternalDeviceCommand,
  InternalDeviceCommands,
} from '../types';
import { HomectlPlugin } from '../plugins';
import { groupBy } from 'fp-ts/lib/NonEmptyArray';
import { checkStateEq, removeUndefined } from '../utils';
import tinycolor from '@ctrl/tinycolor';
import { findLast } from 'fp-ts/lib/Array';
import { toNullable } from 'fp-ts/lib/Option';

const Config = t.type({});
type Config = t.TypeOf<typeof Config>;

interface State {
  devices: InternalDeviceStates;
}

const defaultDeviceState: InternalDeviceState = removeUndefined({
  path: 'unknown',
  brightness: 1,
  scene: undefined,
  sceneActivationTime: undefined,
  transition: undefined,
  color: undefined,
  power: true,
});

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

  registerDevice(path: string, state: DeviceState): InternalDeviceState {
    const device: InternalDeviceState = {
      ...defaultDeviceState,
      ...state,
    };

    this.setDevice(path, device);
    this.log(`Registered device "${path}"`);

    return device;
  }

  async activateScene(sceneName: string) {
    // send scene switch msg to all devices in scene, get scene by sending scenes/somename msg
    const scene = await this.sendMsg(
      `scenes/getScene`,
      InternalDeviceCommands,
      sceneName,
    );

    if (!scene) {
      this.log(`No scene found with name ${sceneName}`);
      return;
    }

    this.log(`Activating scene ${sceneName}`);
    this.applyDeviceCmds(scene, sceneName);
  }

  applyDeviceCmd(cmd: InternalDeviceCommand, sceneName?: string) {
    const device = this.getDevice(cmd.path);

    const sceneProps =
      sceneName === undefined
        ? {}
        : {
            scene: sceneName,
            sceneActivationTime: Date.now(),
            // reset brightness to 1 unless scene specifies otherwise
            brightness: 1,
          };

    return this.setDevice(cmd.path, {
      ...defaultDeviceState,
      ...device,
      transition: 500, // default transition time, cmd can override
      ...sceneProps,
      ...removeUndefined(cmd),
    });
  }

  async applyDeviceCmds(cmds: InternalDeviceCommands, sceneName?: string) {
    for (const cmd of cmds) {
      this.applyDeviceCmd(cmd, sceneName);
    }

    const groupedSceneCmds = groupBy((cmd: InternalDeviceCommand) => {
      const [subsystem, plugin] = cmd.path.split('/');
      return `${subsystem}/${plugin}`;
    })(cmds);

    // TODO: filter out commands that don't affect state
    for (const path in groupedSceneCmds) {
      const group = groupedSceneCmds[path];

      const cmds = group.map(this.internalCmdToDeviceCmd);
      this.sendMsg(path, t.unknown, cmds);
    }
  }

  internalCmdToDeviceCmd = (cmd: InternalDeviceCommand): DeviceCommand => {
    if (!cmd.color) return cmd;

    const brightness = cmd.brightness ?? 1;
    const color = tinycolor(cmd.color).toHsv();
    color.v *= brightness;

    return {
      ...cmd,
      color: tinycolor(color).toHsvString(),
    };
  };

  async discoveredState(discoveredState: DeviceState) {
    let internalState = this.getDevice(discoveredState.path);

    if (!internalState) {
      this.registerDevice(discoveredState.path, discoveredState);

      // this device was unknown to us due to not registering and not appearing
      // in any scene commands yet, we don't have any internal state yet so stop
      // here
      return;
    }

    if (internalState.scene) {
      const scene = await this.sendMsg(
        `scenes/getScene`,
        InternalDeviceCommands,
        internalState.scene,
      );

      const rewrittenPath = this.rewritePath(discoveredState.path);

      // TODO: this isn't entirely correct, since subsequent commands can
      // override values in previous commands. Here we just pick out the
      // latest command and go with that, thus possibly missing out on some
      // values from potential previous commands.
      const cmd = toNullable(
        findLast((cmd: InternalDeviceCommand) => cmd.path === rewrittenPath)(
          scene,
        ),
      );

      if (!cmd) {
        this.log(
          `Could not find DeviceCommands for ${rewrittenPath} in scene ${internalState.scene}`,
        );
        return;
      }

      // don't reset brightness
      internalState = this.applyDeviceCmd({
        ...cmd,
        brightness: undefined,
      });
    }

    // make sure the discovered state matches with our internal state
    const statesEqual = checkStateEq(internalState, discoveredState);

    // states match, do nothing
    if (statesEqual) return;

    this.log(
      'State mismatch detected, correcting...',
      internalState,
      discoveredState,
    );

    const cmds: DeviceCommands = [
      { path: discoveredState.path, ...internalState },
    ].map(this.internalCmdToDeviceCmd);

    this.sendMsg(discoveredState.path, t.unknown, cmds);
  }

  // TODO: this doesn't handle canceling the transition when releasing the dimmer button
  // and always drops the brightness by given rate
  async adjustBrightness(unexpandedPath: string, rate: number) {
    const paths = await this.expandPath(unexpandedPath);

    const cmds = paths
      .map(path => {
        const prevState = this.getDevice(path);

        if (!prevState) {
          this.log(`Cannot adjust brightness for unknown device at ${path}`);
          return;
        }

        const cmd: InternalDeviceCommand = {
          path,
          brightness: 1,
          ...prevState,
          transition: 1000,
        };

        return {
          ...cmd,
          brightness: Math.min(1, Math.max(0, (cmd.brightness ?? 1) + rate)),
        };
      })
      .filter(Boolean) as InternalDeviceCommands;

    await this.applyDeviceCmds(cmds);
  }

  async expandPath(path: string) {
    if (!path.startsWith('groups/')) return [path];

    const devices = await this.sendMsg(path, InternalDeviceStates);

    return Object.keys(devices);
  }

  rewritePath(path: string) {
    return path.replace(/^integrations\//, 'devices/');
  }

  // sets device with rewritten path to devices/*
  setDevice(path: string, device: InternalDeviceState) {
    this.state.devices[this.rewritePath(path)] = device;

    return device;
  }

  // returns device with path rewritten to devices/*
  getDevice(path: string): InternalDeviceState | undefined {
    return this.state.devices[this.rewritePath(path)];
  }

  // returns devices with paths rewritten to devices/*
  getDevices() {
    return Object.fromEntries(
      Object.entries(this.state.devices).map(([path, device]) => {
        return [this.rewritePath(path), device];
      }),
    );
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
        const state = throwDecoder(DeviceState)(
          payload,
          'Unable to decode discoveredState payload',
        );

        this.discoveredState(state);
        break;
      }
      case 'getDevices': {
        return this.getDevices();
      }
      // relay unknown commands to integrations/*
      default:
        await this.sendMsg(`integrations/${path}`, t.unknown, payload);
    }
  }
}
