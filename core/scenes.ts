import * as t from 'io-ts'

import { PluginProps, ScenesConfig, SceneCommand, GroupConfig } from "../types";
import { HomectlPlugin } from '../plugins';

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

  async handleMsg(path: string, payload: unknown) {
    const sceneName = path

    const scene = this.scenes[sceneName]
    if (!scene) return this.log(`No scene found with name ${sceneName}, dropping message: ${path} ${payload}`)

    const sceneCommands: Array<SceneCommand> = []

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

    const groupConfig = await this.sendMsg(path, GroupConfig);
    const devices = groupConfig.devices

    return devices
  }

  async getDynamicProps(props: { [key: string]: unknown }) {
    const dynamicProps: { [key: string]: string } = {}

    for (const key in props) {
      const value = props[key]

      if (typeof value === 'string' && value.startsWith('integrations/')) {
        const path = value
        // FIXME: only supports string values right now
        const dynamicValue = await this.sendMsg(path, t.string)
        dynamicProps[key] = dynamicValue
      }
    }

    return dynamicProps
  }
}