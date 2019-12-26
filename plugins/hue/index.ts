import * as t from 'io-ts'
import { findFirst } from 'fp-ts/lib/Array'
import axios, { Method } from 'axios'

import { BridgeState, BridgeSceneSummary, BridgeSceneCreatedResponse } from "./types";
import { PluginProps, throwDecoder } from "../../types";
import { HomectlPlugin } from '../../plugins';
import { pipe } from 'fp-ts/lib/pipeable';
import { fold } from 'fp-ts/lib/Option';
import { identity } from 'fp-ts/lib/function';
import { findHomectlScene } from './utils';

const Config = t.type({
  addr: t.string,
  username: t.string
})
type Config = t.TypeOf<typeof Config>

/**
 * Philips Hue plugin
 * 
 * Makes Hue bulbs and switches available as homectl devices.
 */

export default class HuePlugin extends HomectlPlugin<Config> {
  homectlSceneId = '';

  constructor(props: PluginProps<Config>) {
    super(props, Config);
  }

  async request<A>(decoder: t.Decoder<unknown, A>, url: string, method: Method = "GET", data?: unknown) {
    const baseURL = `http://${this.config.addr}/api/${this.config.username}`
    this.log(`Making hue request to: ${url}`)
    const { data: response } = await axios({ url, baseURL, method, data })
    const decoded = throwDecoder(decoder)(response, `Unable to decode hue response from ${url}`)
    return decoded
  }

  async register() {
    const bridgeState = await this.request(BridgeState, '/')
    this.log({ bridgeState })

    let homectlSceneId = findHomectlScene(bridgeState)
    if (!homectlSceneId) {
      const createdScene = await this.request(BridgeSceneCreatedResponse, '/scenes', 'POST', { lights: [], recycle: true, name: "homectl" })
      homectlSceneId = createdScene[0].success.id
    }
    this.homectlSceneId = homectlSceneId

    this.log({ homectlSceneId })
    // poll scenes to be optimized every 10s with this.sendMsg(scenes/name), program into bridge if changed enough
  }

  async handleMsg() {
    // handle scene msg for optimized scenes by sending scene switch cmd to bridge

    // otherwise try programming new light states into a temp scene and switch to it?
  }
}
