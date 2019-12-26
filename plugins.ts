import Koa from 'koa'
import * as t from 'io-ts'

import { AppConfig, throwDecoder, PluginProps, SendMsg, IntegrationConfig } from './types'

export abstract class HomectlPlugin<A> {
  id: string
  config: A
  app: Koa
  appConfig: AppConfig
  sendMsg: SendMsg

  constructor({ id, config, app, appConfig, sendMsg }: PluginProps<A>, decoder: t.Decoder<unknown, A>) {
    this.id = id
    this.config = throwDecoder(decoder)(config, `Error while decoding integration config, quitting...`)
    this.app = app
    this.appConfig = appConfig
    this.sendMsg = sendMsg
  }

  log(...msg: any[]) {
    console.log(`[${this.id}]:`, ...msg)
  }

  /**
   * Override this method to handle messages that are sent to paths matching this integration.
   * 
   * @param path remainder of path after integration name is removed
   * @param payload optional payload
   */
  async handleMsg(path: string, payload: unknown): Promise<unknown> {
    return null
  }

  /**
   * Called upon initial integration registration.
   */
  abstract async register(): Promise<void>

  /**
   * Called when all integrations have been loaded
   */
  async start() { }
}

class HomectlPluginImplementation<A> extends HomectlPlugin<A> {
  constructor(props: PluginProps<A>) { super(props, <any>IntegrationConfig) }
  async register() { }
}

export const loadPlugin = (props: PluginProps<IntegrationConfig>) => {
  const Plugin: (typeof HomectlPluginImplementation) = require(`${__dirname}/plugins/${props.config.plugin}`).default
  return new Plugin(props)
}