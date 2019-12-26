import * as t from 'io-ts'
import { PluginProps } from "../types";
import { HomectlPlugin } from '../plugins';

const Config = t.type({
  plugin: t.literal("dummy")
})
type Config = t.TypeOf<typeof Config>

/**
 * Dummy plugin
 * 
 * Does the bare minimum and nothing else
 */

export default class DummyPlugin extends HomectlPlugin<Config> {
  constructor(props: PluginProps<Config>) {
    super(props, Config.decode(props.config));
  }

  async register() {
    console.log('registered dummy plugin', this.config)

    // poll scenes to be optimized every 10s with this.sendMsg(scenes/name), program into bridge if changed enough
  }

  async handleMsg() {
    // handle scene msg for optimized scenes by sending scene switch cmd to bridge

    // otherwise try programming new light states into a temp scene and switch to it?
  }
}
