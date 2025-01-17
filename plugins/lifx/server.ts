import dgram from 'dgram';

import { getBroadcastAddr, mkLifxMsg, toLifxHue, fromLifxHue } from './utils';
import { DiscoverCallback } from './types';
import { DeviceCommand } from '../../types';
import tinycolor from '@ctrl/tinycolor';
import LifxPlugin from '.';
import { mkDevicePath } from '../../utils';

const lifxPort = 56700;

export class LifxServer {
  server: dgram.Socket;
  broadcastAddr: string;

  discoverCallback: DiscoverCallback | undefined;
  discoverTimer: NodeJS.Timeout | undefined;

  constructor(plugin: LifxPlugin, networkInterface: string) {
    this.server = dgram.createSocket('udp4');

    this.server.on('message', (msg, remoteInfo) => {
      if (!this.discoverCallback) return;

      const type = msg.readUInt16LE(32);
      const payload = msg.slice(36);

      switch (type) {
        // State (107) message, response to Get (101)
        // https://lan.developer.lifx.com/docs/light-messages#section-state-107
        case 107: {
          const h = fromLifxHue((payload.readUInt16LE(0) / 65535) * 360); // hue
          const s = payload.readUInt16LE(2) / 65535; // saturation
          const b = payload.readUInt16LE(4) / 65535; // brightness

          const color = tinycolor({ h, s, v: b }).toHsvString();

          const power = payload.readUInt16LE(10) === 65535;

          const l = payload.slice(12, 12 + 32);
          // string *might* be null terminated, and if it isn't, use the whole string
          const label = l.includes('\0')
            ? l.toString('utf8', 0, l.indexOf('\0'))
            : l.toString('utf8');

          this.discoverCallback({
            ip: remoteInfo.address,
            label,
            state: {
              path: mkDevicePath(plugin, label),
              color,
              power,
            },
          });

          break;
        }
      }
    });

    this.broadcastAddr = getBroadcastAddr(networkInterface);
  }

  register = async () => {
    await new Promise(resolve => this.server.bind(lifxPort, resolve));
    this.server.setBroadcast(true);
  };

  discover = (callback: DiscoverCallback) => {
    this.discoverCallback = callback;
    this.doDiscover();
  };

  doDiscover = () => {
    // broadcast Get (101) message
    // https://lan.developer.lifx.com/docs/light-messages#section-get-101
    this.server.send(mkLifxMsg(101, true), lifxPort, this.broadcastAddr);
    this.resetDiscoverTimer();
  };

  resetDiscoverTimer = () => {
    if (this.discoverTimer) clearTimeout(this.discoverTimer);
    this.discoverTimer = setTimeout(this.doDiscover, 1000);
  };

  setLightColor = (ip: string, cmd: DeviceCommand) => {
    // defer light state discovery so we don't discover old state before the
    // current DeviceCommand update has completed
    this.resetDiscoverTimer();

    const color = tinycolor(cmd.color);

    const { transition = 500, power } = cmd;
    const hsv = color.toHsv();

    // send SetPower (117) message
    // https://lan.developer.lifx.com/docs/light-messages#section-setpower-117
    const setPowerPayload = Buffer.alloc(16 + 32);
    setPowerPayload.writeUInt16LE(power ? 65535 : 0, 0);
    setPowerPayload.writeUInt16LE(transition, 2);
    this.server.send(mkLifxMsg(117, false, setPowerPayload), lifxPort, ip);

    // stop here if we're turning power off, no use setting colors then
    if (!power) return;

    // send SetColor (102) message
    // https://lan.developer.lifx.com/docs/light-messages#section-setcolor-102
    const setColorPayload = Buffer.alloc(8 + 16 * 4 + 32);
    setColorPayload.writeUInt16LE(
      Math.floor((toLifxHue(hsv.h) / 360) * 65535),
      1,
    );
    setColorPayload.writeUInt16LE(Math.floor(hsv.s * 65535), 3);
    setColorPayload.writeUInt16LE(Math.floor(hsv.v * 65535), 5);
    setColorPayload.writeUInt16LE(6500, 7);
    setColorPayload.writeUInt32LE(transition, 9);
    this.server.send(mkLifxMsg(102, false, setColorPayload), lifxPort, ip);
  };
}
