import * as t from 'io-ts'

import { PluginProps, IntegrationsConfig } from './types'
import { HomectlPlugin, loadPlugin } from './plugins'

const Config = IntegrationsConfig
type Config = t.TypeOf<typeof Config>

/**
 * Integrations plugin (core)
 * 
 * Load all configured integrations
 */

export default class IntegrationsPlugin extends HomectlPlugin<Config> {
  integrationInstances: { [key: string]: HomectlPlugin<unknown> | undefined } = {};

  constructor(props: PluginProps<Config>) {
    super(props, Config);
  }

  async register() {
    for (const id in this.config) {
      const config = this.config[id]
      const instance = loadPlugin({
        id,
        config,
        app: this.app,
        appConfig: this.appConfig,
        sendMsg: this.sendMsg
      })

      this.integrationInstances[id] = instance;
      await instance.register()
      this.log(`Loaded integration ${id}`)
    }
  }

  async start() {
    for (const integrationName in this.integrationInstances) {
      const instance = this.integrationInstances[integrationName]
      await instance?.start();
    }
  }

  async handleMsg(path: string, payload: unknown) {
    const [integration, ...fwdPath] = path.split('/')

    const instance = this.integrationInstances[integration]
    if (!instance) return this.log(`no integration loaded with name ${integration}, dropping message: ${path} ${payload}`)

    return instance.handleMsg(fwdPath.join('/'), payload);
  }
}