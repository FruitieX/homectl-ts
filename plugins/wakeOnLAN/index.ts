import * as t from 'io-ts';
import wol, { WakeOptions } from 'wake_on_lan';

import { PluginProps, throwDecoder, DeviceCommand } from '../../types';
import { HomectlPlugin } from '../../plugins';
import { lookup } from 'fp-ts/lib/Record';
import { fold } from 'fp-ts/lib/Option';
import { identity } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/pipeable';
import axios from 'axios';

const Config = t.type({
  sleepOnLAN: t.union([t.boolean, t.undefined]),
  sleepOnLANEndpoint: t.union([t.string, t.undefined]),
  aliases: t.union([t.record(t.string, t.string), t.undefined]),
});
type Config = t.TypeOf<typeof Config>;

/**
 * Wake on LAN plugin
 *
 * Allows waking desktop PC but also putting it to sleep via Sleep-On-Lan
 * https://github.com/SR-G/sleep-on-lan
 */

export default class WakeOnLANPlugin extends HomectlPlugin<Config> {
  constructor(props: PluginProps<Config>) {
    super(props, Config);
  }

  start = async () => {
    for (const alias in this.config.aliases) {
      await this.sendMsg('devices/discoveredState', t.unknown, {
        path: `integrations/${this.id}/${alias}`,
        power: false,
      })
    }
  }

  findAlias(name: string) {
    if (!this.config.aliases) return name;

    return pipe(
      lookup(name, this.config.aliases),
      fold(() => name, identity),
    );
  }

  async handleMsg(path: string, payload: unknown) {
    const cmds = throwDecoder(t.array(DeviceCommand))(
      payload,
      'Unable to decode wakeOnLAN payload',
    );

    for (const cmd of cmds) {
      const [, , name] = cmd.path.split('/');
      const address = this.findAlias(name);
      const options: WakeOptions = { num_packets: 1 };

      if (cmd.power) {
        this.log(`Sending wake on lan packet to ${address}`);
        wol.wake(address, options);
      } else if (this.config.sleepOnLAN && this.config.sleepOnLANEndpoint) {
        this.log(`Sending sleep on lan packet to ${address}`);
        await axios({ method: 'GET', url: this.config.sleepOnLANEndpoint });
      }
    }
  }
}
