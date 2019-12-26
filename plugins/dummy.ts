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
    super(props, Config);
  }

  async register() {
    console.log('registered dummy plugin', this.config)
  }
}