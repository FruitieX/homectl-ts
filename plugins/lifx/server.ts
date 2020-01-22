import dgram from 'dgram'

import { getBroadcastAddr } from './utils'
import { DiscoverCallback } from './types'
import { DeviceCommand } from '../../types'
import { TinyColor } from '@ctrl/tinycolor'

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

  setLightColor = (ip: string, color: TinyColor, brightness = 1, transition = 500) => {
    const payload = Buffer.alloc(8 + 16 * 4 + 32)
    const hsv = color.toHsv();
    console.log(hsv)
    payload.writeUInt16LE(Math.floor(hsv.h / 360 * 65535), 1)
    payload.writeUInt16LE(Math.floor(hsv.s / 100 * 65535), 3)
    payload.writeUInt16LE(Math.floor(hsv.v / 100 * brightness * 65535), 5)
    payload.writeUInt16LE(6500, 7)
    payload.writeUInt32LE(transition, 9)
    this.server.send(this.buildMsg(102, payload), lifxPort, ip)
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
