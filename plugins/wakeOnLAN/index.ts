import * as t from 'io-ts';
import wol from 'wake_on_lan';

import { PluginProps, throwDecoder, DeviceCommand } from '../../types';
import { HomectlPlugin } from '../../plugins';
import { lookup } from 'fp-ts/lib/Record';
import { fold } from 'fp-ts/lib/Option';
import { identity } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/pipeable';
import { range } from 'fp-ts/lib/Array';

const Config = t.type({
  sleepOnLAN: t.union([t.boolean, t.undefined]),
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

  findAlias(name: string) {
    if (!this.config.aliases) return name;

    return pipe(
      lookup(name, this.config.aliases),
      fold(() => name, identity),
    );
  }

  // assuming 00:00:00:00:00:00 format
  invertAddress(a: string) {
    const getOctet = (offset: number) => `${a[offset * 3]}${a[offset * 3 + 1]}`;
    return range(0, 5)
      .map(i => getOctet(5 - i))
      .join(':');
  }

  async handleMsg(path: string, payload: unknown) {
    const cmds = throwDecoder(t.array(DeviceCommand))(
      payload,
      'Unable to decode wakeOnLAN payload',
    );

    for (const cmd of cmds) {
      const [, , name] = cmd.path.split('/');
      const address = this.findAlias(name);

      if (cmd.power) {
        this.log(`Sending wake on lan packet to ${address}`);
        wol.wake(address);
      } else if (this.config.sleepOnLAN) {
        this.log(`Sending sleep on lan packet to ${address}`);
        wol.wake(this.invertAddress(address));
      }
    }
  }
}
