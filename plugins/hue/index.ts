import * as t from 'io-ts'
import axios, { Method } from 'axios'

import { BridgeState, BridgeSceneCreatedResponse, BridgeSensors, BridgeSensor, BridgeLights, BridgeLight } from "./types";
import { PluginProps, throwDecoder } from "../../types";
import { HomectlPlugin } from '../../plugins';
import { findHomectlScene, bridgeSensorsDiff } from './utils';
import { map } from 'fp-ts/lib/Record';

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
  bridgeSensors: BridgeSensors = {};
  bridgeLights: BridgeLights = {};

  constructor(props: PluginProps<Config>) {
    super(props, Config);
  }

  async request<A>(decoder: t.Decoder<unknown, A>, url: string, method: Method = "GET", data?: unknown) {
    const baseURL = `http://${this.config.addr}/api/${this.config.username}`
    if (url !== '/sensors') this.log(`Making hue request to: ${url}`)
    const { data: response } = await axios({ url, baseURL, method, data })
    const decoded = throwDecoder(decoder)(response, `Unable to decode hue response from ${url}`)
    return decoded
  }

  async register() {
    const bridgeState = await this.request(BridgeState, '/')
    this.log({ bridgeState })

    this.bridgeLights = bridgeState.lights
    this.bridgeSensors = bridgeState.sensors

    let homectlSceneId = findHomectlScene(bridgeState)
    if (!homectlSceneId) {
      const createdScene = await this.request(BridgeSceneCreatedResponse, '/scenes', 'POST', { lights: [], recycle: true, name: "homectl" })
      homectlSceneId = createdScene[0].success.id
    }
    this.homectlSceneId = homectlSceneId

    this.log({ homectlSceneId })

    // TODO: try doing without this first
    // poll scenes to be optimized every 10s with this.sendMsg(scenes/name), program into bridge if changed enough
  }

  start = async () => {
    map((light: BridgeLight) => this.app.emit('registerDevice', `integrations/${this.id}/${light.name}`))(this.bridgeLights)
    map((sensor: BridgeSensor) => {
      if (sensor.type !== "ZLLSwitch") return
      ['on', 'dimUp', 'dimDown', 'off'].map(button => this.app.emit('registerSensor', `integrations/${this.id}/${sensor.name}/${button}`))
    })(this.bridgeSensors)
    this.pollSwitches()
  }

  pollSwitches = async () => {
    const newBridgeSensors = await this.request(BridgeSensors, '/sensors')
    const sensorUpdates = bridgeSensorsDiff(this.id)(this.bridgeSensors, newBridgeSensors)
    this.bridgeSensors = newBridgeSensors;

    for (const update of sensorUpdates) {
      await this.sendMsg('routines/valueChange', t.unknown, update)
    }

    setTimeout(this.pollSwitches, 100)
  }

  async handleMsg(path: string, payload: unknown) {
    // TODO: try doing without this first
    // handle scene msg for optimized scenes by sending scene switch cmd to bridge

    // otherwise try programming new light states into a temp scene and switch to it?
    this.log('handleMsg unimplemented', { path, payload })
  }
}
