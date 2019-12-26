import Koa from 'koa'
import * as t from 'io-ts'
import { AppConfig, throwDecoder, PluginProps, SendMsg, IntegrationsConfig } from './types'
import { Either, left } from 'fp-ts/lib/Either'
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
    super(props, Config.decode(props.config));
  }

  async register() {
    for (const integrationName in this.config) {
      const config = this.config[integrationName]
      const instance = loadPlugin({
        config,
        app: this.app,
        appConfig: this.appConfig,
        sendMsg: this.sendMsg
      })

      this.integrationInstances[integrationName] = instance;
      await instance.register()
      console.log(`loaded integration ${integrationName}`)
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
    if (!instance) return console.log(`no integration loaded with name ${integration}, dropping message: ${path} ${payload}`)

    return instance.handleMsg(fwdPath.join('/'), payload);
  }
}