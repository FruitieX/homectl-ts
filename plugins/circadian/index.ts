import * as t from 'io-ts';

import { PluginProps } from '../../types';
import { HomectlPlugin } from '../../plugins';
import tinycolor, { TinyColor } from '@ctrl/tinycolor';

const Config = t.type({
  dayColor: t.string,
  dayFadeStartHour: t.number,
  dayFadeDuration: t.number,
  nightColor: t.string,
  nightFadeStartHour: t.number,
  nightFadeDuration: t.number,
});
type Config = t.TypeOf<typeof Config>;

/**
 * Circadian plugin
 *
 * Provides data on circadian rhythm. Currently doesn't care about location, only system time.
 */

export default class CircadianPlugin extends HomectlPlugin<Config> {
  dayColor: TinyColor;
  nightColor: TinyColor;

  constructor(props: PluginProps<Config>) {
    super(props, Config);

    this.dayColor = tinycolor(this.config.dayColor);
    this.nightColor = tinycolor(this.config.nightColor);
  }

  getNightFade = (): number => {
    const t = Date.now();
    const dayFadeStart = new Date().setHours(
      this.config.dayFadeStartHour,
      0,
      0,
      0,
    );
    const dayFadeEnd = new Date().setHours(
      this.config.dayFadeStartHour + this.config.dayFadeDuration,
      0,
      0,
      0,
    );

    const nightFadeStart = new Date().setHours(
      this.config.nightFadeStartHour,
      0,
      0,
      0,
    );
    const nightFadeEnd = new Date().setHours(
      this.config.nightFadeStartHour + this.config.nightFadeDuration,
      0,
      0,
      0,
    );

    if (t <= dayFadeStart || t >= nightFadeEnd) return 1;
    if (t >= dayFadeEnd && t <= nightFadeStart) return 0;

    if (t < dayFadeEnd) {
      // fading from night to day
      const p = (t - dayFadeStart) / (dayFadeEnd - dayFadeStart);

      return 1 - p;
    } else {
      // fading from day to night
      const p = (t - nightFadeStart) / (nightFadeEnd - nightFadeStart);

      return p;
    }
  };

  async handleMsg(path: string, payload: unknown) {
    const cmd = path;

    switch (cmd) {
      case 'color': {
        const p = this.getNightFade();
        const color = this.dayColor.mix(this.nightColor, p * 100);
        return color.toHsvString();
      }
      default:
        this.log(`Unknown cmd received: ${cmd}`);
    }
  }
}
