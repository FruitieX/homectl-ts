import Koa from 'koa'
import * as t from 'io-ts'
import { AppConfig, throwDecoder, PluginProps, SendMsg, IntegrationConfig } from './types'
import { Either, left } from 'fp-ts/lib/Either'

export abstract class HomectlPlugin<A> {
  config: A
  app: Koa
  appConfig: AppConfig
  sendMsg: SendMsg

  constructor({ app, appConfig, sendMsg }: PluginProps<A>, decoded: Either<t.Errors, A>) {
    this.config = this.decode(decoded)
    this.app = app
    this.appConfig = appConfig
    this.sendMsg = sendMsg
  }

  decode(decoded: Either<t.Errors, A>): A {
    return throwDecoder(decoded, `Error while decoding integration config, quitting...`)
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
  constructor(props: PluginProps<A>) { super(props, left(<any>undefined)) }
  async register() { }
}

export const loadPlugin = (props: PluginProps<IntegrationConfig>) => {
  const Plugin: (typeof HomectlPluginImplementation) = require(`${__dirname}/plugins/${props.config.plugin}`).default
  return new Plugin(props)
}