import * as t from 'io-ts'

import { PluginProps, ScenesConfig, DeviceCommand, GroupConfig, throwDecoder } from "../types";
import { HomectlPlugin } from '../plugins';
import tinycolor from '@ctrl/tinycolor';

const Config = ScenesConfig
type Config = t.TypeOf<typeof Config>

/**
 * Scenes plugin
 * 
 * Manages scenes in configuration.
 */

export default class ScenesPlugin extends HomectlPlugin<Config> {
  scenes: ScenesConfig = {}

  constructor(props: PluginProps<Config>) {
    super(props, Config);
  }

  async register() {
    this.scenes = this.config
  }

  async handleMsg(path: string, payload: unknown): Promise<Array<DeviceCommand> | void> {
    const cmd = path

    switch (cmd) {
      case 'getScene': {
        const sceneName = throwDecoder(t.string)(payload, 'Unable to decode scene name')
        return await this.getScene(sceneName)
      }
      default:
        this.log(`Unknown command received: ${cmd}`)
    }
  }

  async getScene(sceneName: string): Promise<Array<DeviceCommand> | undefined> {
    const scene = this.scenes[sceneName]
    if (!scene) return

    const sceneCommands: Array<DeviceCommand> = []

    for (const sceneCommand of scene.devices) {
      const dynamicProps = await this.getDynamicProps(sceneCommand)
      const paths = await this.expandPath(sceneCommand.path)
      const duplicateSceneCommands = paths.map(path => ({
        ...sceneCommand,
        ...dynamicProps,
        path
      }))
      sceneCommands.push(...duplicateSceneCommands)
    }

    return sceneCommands
  }

  async expandPath(path: string) {
    if (!path.startsWith('groups/')) return [path]

    const devices = await this.sendMsg(path, t.array(t.string));

    return devices
  }

  async getDynamicProps(props: { [key: string]: unknown }) {
    const dynamicProps: { [key: string]: unknown } = {}

    const blacklist = ['path']

    for (const key in props) {
      if (blacklist.includes(key)) continue;

      const value = props[key]

      if (typeof value === 'string' && value.startsWith('integrations/')) {
        const path = value
        dynamicProps[key] = await this.sendMsg(path, t.string)
      } else if (typeof value === 'string') {
        // try parsing value with TinyColor
        const color = tinycolor(value)
        if (color.isValid) {
          dynamicProps[key] = color.toHsvString()
        }
      }
    }

    return dynamicProps
  }
}