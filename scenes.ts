// implement handleMsg that responds with calculated scene state of matching scene path.
import * as t from 'io-ts'
import { PluginProps, ScenesConfig, SceneCommand, GroupConfig, throwDecoder } from "./types";
import { HomectlPlugin } from './plugins';

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
    super(props, Config.decode(props.config));
  }

  async register() {
    this.scenes = this.config
  }

  async handleMsg(path: string, payload: unknown) {
    const sceneName = path

    const scene = this.scenes[sceneName]
    if (!scene) return console.log(`no scene found with name ${sceneName}, dropping message: ${path} ${payload}`)

    const sceneCommands: Array<SceneCommand> = []

    for (const sceneCommand of scene.devices) {
      const paths = this.expandPath(sceneCommand.path)
      const duplicateSceneCommands = paths.map(path => ({
        ...sceneCommand,
        path
      }))
      sceneCommands.push(...duplicateSceneCommands)
    }

    return sceneCommands
  }

  expandPath(path: string) {
    if (!path.startsWith('groups/')) return [path]

    const mGroupConfig = this.sendMsg(path);
    const groupConfig = throwDecoder(GroupConfig.decode(mGroupConfig), 'Failed to decode group config')
    const devices = groupConfig.devices

    return devices
  }
}