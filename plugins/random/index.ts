import * as t from 'io-ts';

import { PluginProps } from '../../types';
import { HomectlPlugin } from '../../plugins';
import tinycolor from '@ctrl/tinycolor';

const Config = t.type({});
type Config = t.TypeOf<typeof Config>;

/**
 * Random plugin
 *
 * Provides random data, mostly useful for debugging purposes
 */

export default class RandomPlugin extends HomectlPlugin<Config> {
  constructor(props: PluginProps<Config>) {
    super(props, Config);
  }

  async handleMsg(path: string, payload: unknown) {
    const cmd = path;

    switch (cmd) {
      case 'color': {
        return tinycolor({
          r: Math.random() * 255,
          g: Math.random() * 255,
          b: Math.random() * 255,
        }).toHsvString();
      }
      default:
        this.log(`Unknown cmd received: ${cmd}`);
    }
  }
}
