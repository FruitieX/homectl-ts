import dgram from 'dgram'

import { getBroadcastAddr } from './utils'
import { DiscoverCallback } from './types'
import { DeviceCommand } from '../../types'
import tinycolor, { TinyColor } from '@ctrl/tinycolor'

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
        // GetLabel response
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

    // broadcast GetLabel message
    this.server.send(this.buildMsg(23), lifxPort, this.broadcastAddr)
  }

  setLightColor = (ip: string, cmd: DeviceCommand) => {
    const color = tinycolor(cmd.color)

    const { brightness = 1, transition = 500, power } = cmd
    const hsv = color.toHsv();

    const setPowerPayload = Buffer.alloc(16 + 32);
    setPowerPayload.writeUInt16LE(power ? 65535 : 0, 0)
    setPowerPayload.writeUInt16LE(transition, 2)
    this.server.send(this.buildMsg(117, setPowerPayload), lifxPort, ip)

    if (!power) return
    const setColorPayload = Buffer.alloc(8 + 16 * 4 + 32)
    setColorPayload.writeUInt16LE(Math.floor(hsv.h / 360 * 65535), 1)
    setColorPayload.writeUInt16LE(Math.floor(hsv.s * 65535), 3)
    setColorPayload.writeUInt16LE(Math.floor(hsv.v * brightness * 65535), 5)
    setColorPayload.writeUInt16LE(6500, 7)
    setColorPayload.writeUInt32LE(transition, 9)
    this.server.send(this.buildMsg(102, setColorPayload), lifxPort, ip)
  }

  buildMsg = (type: number, payload?: Buffer) => {
    // frame
    // https://lan.developer.lifx.com/docs/header-description#frame
    const frame = Buffer.alloc(8)
    const protocol = 1024
    const origin = 0
    const tagged = 1
    const addressable = 1

    frame.writeUInt16LE(0, 0) // size will be filled in later
    frame.writeUInt16LE(protocol | (origin << 14) | (tagged << 13) | (addressable << 12), 2)
    frame.writeUInt32LE(1, 4)

    // frame address
    // https://lan.developer.lifx.com/docs/header-description#frame-address
    const frameAddress = Buffer.alloc(16)
    const ackRequired = 0
    const resRequired = 1

    frameAddress.writeUInt8((ackRequired << 1) | resRequired, 14)

    // protocol header
    // https://lan.developer.lifx.com/docs/header-description#protocol-header
    const protocolHeader = Buffer.alloc(12)
    protocolHeader.writeUInt16LE(type, 8)

    const buffers = [frame, frameAddress, protocolHeader]
    if (payload) buffers.push(payload)

    const msg = Buffer.concat(buffers)

    // finally write the size
    msg.writeUInt16LE(msg.length, 0);

    return msg
  }
}
