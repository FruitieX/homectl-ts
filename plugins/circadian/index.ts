import * as t from 'io-ts';

import { PluginProps } from '../../types';
import { HomectlPlugin } from '../../plugins';
import { kelvinToRGB } from './kelvin2rgb';
import tinycolor from '@ctrl/tinycolor';

const Config = t.type({
  dayColorTemperature: t.number,
  dayFadeStartHour: t.number,
  dayFadeDuration: t.number,
  nightColorTemperature: t.number,
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
  constructor(props: PluginProps<Config>) {
    super(props, Config);
  }

  getCurrentColorTemp = (): number => {
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

    if (t <= dayFadeStart || t >= nightFadeEnd)
      return this.config.nightColorTemperature;
    if (t >= dayFadeEnd && t <= nightFadeStart)
      return this.config.dayColorTemperature;

    if (t < dayFadeEnd) {
      // fading from night to day
      const p = (t - dayFadeStart) / (dayFadeEnd - dayFadeStart);
      return (
        this.config.nightColorTemperature * (1 - p) +
        this.config.dayColorTemperature * p
      );
    } else {
      // fading from day to night
      const p = (t - nightFadeStart) / (nightFadeEnd - nightFadeStart);
      return (
        this.config.dayColorTemperature * (1 - p) +
        this.config.nightColorTemperature * p
      );
    }
  };

  async handleMsg(path: string, payload: unknown) {
    const cmd = path;

    switch (cmd) {
      case 'color': {
        const [r, g, b] = kelvinToRGB(this.getCurrentColorTemp());
        this.log({ r, g, b, ct: this.getCurrentColorTemp() });
        return tinycolor({ r, g, b }).toHsvString();
      }
      default:
        this.log(`Unknown cmd received: ${cmd}`);
    }
  }
}
