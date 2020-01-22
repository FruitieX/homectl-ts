import dgram from 'dgram'

import { getBroadcastAddr, mkLifxMsg } from './utils'
import { DiscoverCallback } from './types'
import { DeviceCommand } from '../../types'
import tinycolor from '@ctrl/tinycolor'

const lifxPort = 56700

export class LifxServer {
  server: dgram.Socket
  broadcastAddr: string
  discoverCallback: DiscoverCallback | undefined

  constructor(networkInterface: string) {
    this.server = dgram.createSocket('udp4')

    this.server.on('message', (msg, remoteInfo) => {
      if (!this.discoverCallback) return;

      const type = msg.readUInt16LE(32)
      const payload = msg.slice(36)

      switch (type) {
        // StateLabel (25) message, response to GetLabel (23)
        // https://lan.developer.lifx.com/docs/device-messages#section-statelabel-25
        case 25: {
          // the label might be padded with null bytes
          const label = payload.includes("\0") ? payload.toString('utf8', 0, payload.indexOf("\0")) : payload.toString('utf8')

          this.discoverCallback({
            ip: remoteInfo.address,
            label
          })
          break;
        }
      }
    })

    this.broadcastAddr = getBroadcastAddr(networkInterface)
  }

  register = async () => {
    await new Promise(resolve => this.server.bind(lifxPort, resolve))
    this.server.setBroadcast(true)
  }

  discover = (callback: DiscoverCallback) => {
    this.discoverCallback = callback;

    // broadcast GetLabel (23) message
    // https://lan.developer.lifx.com/docs/device-messages#section-getlabel-23
    this.server.send(mkLifxMsg(23), lifxPort, this.broadcastAddr)
  }

  setLightColor = (ip: string, cmd: DeviceCommand) => {
    const color = tinycolor(cmd.color)

    const { brightness = 1, transition = 500, power } = cmd
    const hsv = color.toHsv();

    // send SetPower (117) message
    // https://lan.developer.lifx.com/docs/light-messages#section-setpower-117
    const setPowerPayload = Buffer.alloc(16 + 32);
    setPowerPayload.writeUInt16LE(power ? 65535 : 0, 0)
    setPowerPayload.writeUInt16LE(transition, 2)
    this.server.send(mkLifxMsg(117, setPowerPayload), lifxPort, ip)

    // stop here if we're turning power off, no use setting colors then
    if (!power) return

    // send SetColor (102) message
    // https://lan.developer.lifx.com/docs/light-messages#section-setcolor-102
    const setColorPayload = Buffer.alloc(8 + 16 * 4 + 32)
    setColorPayload.writeUInt16LE(Math.floor(hsv.h / 360 * 65535), 1)
    setColorPayload.writeUInt16LE(Math.floor(hsv.s * 65535), 3)
    setColorPayload.writeUInt16LE(Math.floor(hsv.v * brightness * 65535), 5)
    setColorPayload.writeUInt16LE(6500, 7)
    setColorPayload.writeUInt32LE(transition, 9)
    this.server.send(mkLifxMsg(102, setColorPayload), lifxPort, ip)
  }
}
