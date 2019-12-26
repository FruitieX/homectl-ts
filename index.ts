import Koa from 'koa'
import { loadConfig } from './config';
import IntegrationsPlugin from './integrations';
import { HomectlPlugin } from './plugins';
import ScenesPlugin from './scenes';

const app = new Koa();

const init = async () => {
  const config = await loadConfig()
  console.log('Successfully loaded config.')
  console.log(config);

  const subsystems: { [name: string]: HomectlPlugin<unknown> } = {}

  const sendMsg = (path: string, payload: unknown) => {
    const [subsystem, ...fwdPath] = path.split('/')

    const instance = subsystems[subsystem]
    if (!instance) return console.log(`no subsystem loaded with name ${subsystem}, dropping message: ${path} ${payload}`)

    return instance.handleMsg(fwdPath.join('/'), payload);
  }

  const commonProps = {
    app,
    appConfig: config,
    sendMsg
  }

  subsystems.integrations = new IntegrationsPlugin({ config: config.integrations, ...commonProps })
  subsystems.scenes = new ScenesPlugin({ config: config.scenes, ...commonProps })

  for (const subsystemName in subsystems) {
    const subsystem = subsystems[subsystemName];
    await subsystem.register()
    console.log(`loaded subsystem ${subsystemName}`)
  }

  for (const subsystemName in subsystems) {
    const subsystem = subsystems[subsystemName];
    await subsystem.start()
  }
}

init();