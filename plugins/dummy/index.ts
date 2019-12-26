import * as t from 'io-ts'

import { PluginProps } from "../../types";
import { HomectlPlugin } from '../../plugins';

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
    this.log('Registered dummy plugin', this.config)
  }
}