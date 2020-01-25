import Koa from 'koa';
import * as t from 'io-ts';

import { loadConfig } from './config';
import { HomectlPlugin } from './plugins';
import { throwDecoder } from './types';

import IntegrationsPlugin from './core/integrations';
import ScenesPlugin from './core/scenes';
import GroupsPlugin from './core/groups';
import RoutinesPlugin from './core/routines';
import DevicesPlugin from './core/devices';

const app = new Koa();

/**
 * Loads all subsystems in order and calls .start() on them when all subsystems have been loaded.
 */
const init = async () => {
  const config = await loadConfig();

  const subsystems: { [name: string]: HomectlPlugin<unknown> } = {};

  const sendMsg = async <A>(
    path: string,
    decoder: t.Decoder<unknown, A>,
    payload?: unknown,
  ) => {
    const [subsystem, ...splitFwdPath] = path.split('/');

    const instance = subsystems[subsystem];
    if (!instance)
      throw new Error(
        `No subsystem loaded with name ${subsystem}, dropping message: ${path} ${payload}`,
      );

    const fwdPath = splitFwdPath.join('/');

    const retVal = await instance.handleMsg(fwdPath, payload);

    // console.log('sendMsg', { path, payload, retVal });

    const decoded = throwDecoder(decoder)(
      retVal,
      `Unable to decode return value of ${fwdPath} ${payload}`,
    );
    return decoded;
  };

  const commonProps = {
    app,
    appConfig: config,
    sendMsg,
  };

  subsystems.integrations = new IntegrationsPlugin({
    id: 'integrations',
    config: config.integrations,
    ...commonProps,
  });
  subsystems.devices = new DevicesPlugin({
    id: 'devices',
    config: {},
    ...commonProps,
  });
  subsystems.scenes = new ScenesPlugin({
    id: 'scenes',
    config: config.scenes,
    ...commonProps,
  });
  subsystems.groups = new GroupsPlugin({
    id: 'groups',
    config: config.groups,
    ...commonProps,
  });
  subsystems.routines = new RoutinesPlugin({
    id: 'routines',
    config: config.routines,
    ...commonProps,
  });

  for (const subsystemName in subsystems) {
    const subsystem = subsystems[subsystemName];
    await subsystem.register();
    console.log(`Loaded subsystem ${subsystemName}`);
  }

  for (const subsystemName in subsystems) {
    const subsystem = subsystems[subsystemName];
    await subsystem.start();
  }

  console.log(`Initialization complete.`);
};

init();
