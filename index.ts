import Koa from 'koa'
import * as t from 'io-ts'
import { loadConfig } from './config';
import IntegrationsPlugin from './integrations';
import { HomectlPlugin } from './plugins';
import ScenesPlugin from './scenes';
import { throwDecoder } from './types';

const app = new Koa();

const init = async () => {
  const config = await loadConfig()
  console.log('Successfully loaded config.')
  console.log(config);

  const subsystems: { [name: string]: HomectlPlugin<unknown> } = {}

  const sendMsg = async <A>(path: string, decoder: t.Decoder<unknown, A>, payload?: unknown) => {
    const [subsystem, ...splitFwdPath] = path.split('/')

    const instance = subsystems[subsystem]
    if (!instance) throw new Error(`No subsystem loaded with name ${subsystem}, dropping message: ${path} ${payload}`)

    const fwdPath = splitFwdPath.join('/')
    const retVal = await instance.handleMsg(fwdPath, payload);

    const decoded = throwDecoder(decoder)(retVal, `Unable to decode return value of ${fwdPath} ${payload}`)
    return decoded
  }

  const commonProps = {
    app,
    appConfig: config,
    sendMsg
  }

  subsystems.integrations = new IntegrationsPlugin({ id: "integrations", config: config.integrations, ...commonProps })
  subsystems.scenes = new ScenesPlugin({ id: "scenes", config: config.scenes, ...commonProps })

  for (const subsystemName in subsystems) {
    const subsystem = subsystems[subsystemName];
    await subsystem.register()
    console.log(`Loaded subsystem ${subsystemName}`)
  }

  for (const subsystemName in subsystems) {
    const subsystem = subsystems[subsystemName];
    await subsystem.start()
  }
}

init();