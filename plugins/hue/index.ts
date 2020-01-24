import * as t from 'io-ts'
import axios, { Method } from 'axios'

import { BridgeState, BridgeSceneCreatedResponse, BridgeSensors, BridgeSensor, BridgeLights, BridgeLight, BridgeLightState, BridgeLightStates } from "./types";
import { PluginProps, throwDecoder, DeviceCommand } from "../../types";
import { HomectlPlugin } from '../../plugins';
import { findHomectlScene, bridgeSensorsDiff, tinycolorToHue, sceneCmdToHue, hueToTinycolor } from './utils';
import { map } from 'fp-ts/lib/Record';
import { findIndex } from 'ramda';
import { findFirst } from 'fp-ts/lib/Array';
import { pipe } from 'fp-ts/lib/pipeable';
import { fold } from 'fp-ts/lib/Option';
import tinycolor from '@ctrl/tinycolor';

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
  }

  start = async () => {
    map((light: BridgeLight) => this.app.emit('registerDevice', `integrations/${this.id}/${light.name}`))(this.bridgeLights)
    map((sensor: BridgeSensor) => {
      if (sensor.type !== "ZLLSwitch") return
      ['on', 'dimUp', 'dimDown', 'off'].map(button => this.app.emit('registerSensor', `integrations/${this.id}/${sensor.name}/${button}`))
    })(this.bridgeSensors)
    this.pollSwitches()
    this.pollLights()
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

  pollLights = async () => {
    const newBridgeLights = await this.request(BridgeLights, '/lights')

    for (const lightId in newBridgeLights) {
      const { state, name } = newBridgeLights[lightId]
      const color = hueToTinycolor(state).toHsvString()

      await this.sendMsg('devices/discoveredState', t.unknown, {
        path: `integrations/${this.id}/${name}`,
        state: {
          power: state.on,
          color
        } 
      })
    }

    setTimeout(this.pollLights, 10000)
  }

  async handleMsg(path: string, payload: unknown) {
    const cmds = throwDecoder(t.array(DeviceCommand))(payload, "Unable to decode batch light update")

    const lightstates: BridgeLightStates = {}

    for (const cmd of cmds) {
      const lightId = pipe(
        findFirst(([id, light]: [string, BridgeLight]) => cmd.path.endsWith(`/${light.name}`))(Object.entries(this.bridgeLights)),
        fold(() => undefined, (([key]) => key))
      )

      if (!lightId) {
        this.log(`Cannot find lightId for path ${cmd.path}`)
        continue
      }

      lightstates[lightId] = sceneCmdToHue(cmd)
    }

    // loop through lightstates and send one request per lightstate update to the bridge
    // this sort of breaks down with large numbers of lights

    for (const lightId in lightstates) {
      const lightstate = lightstates[lightId]
      await this.request(t.unknown, `/lights/${lightId}/state`, 'PUT', lightstate)
    }

    // TODO: find some way of batch updating lights, for example store common scenes in
    // the bridge so we can switch to those with one request

    // idea 1: find identical lightstates and create bridge groups for those,
    // future updates to these lights can now get by with 1 request
    // TODO: use group 0 if lightstates contains all bridge lights

    // idea 2: store commonly used scenes in the bridge, update these periodically (if they contain changes)

    // idea 3: program the lightstate changes into a scene and switch to that scene instantly
    // (turns out this doesn't work very well)

    // const body = {
    //   lights: Object.keys(lightstates),
    //   lightstates
    // }
    // 
    // this.log('updating scene', { body })
    // await this.request(t.unknown, `/scenes/${this.homectlSceneId}`, 'PUT', body)
    // this.log('activating scene')
    // await this.request(t.unknown, `/groups/0/action`, 'PUT', { scene: this.homectlSceneId })
    // this.log('activated scene')
  }
}
