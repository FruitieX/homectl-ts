import os from 'os';

// from https://github.com/aal89/broadcast-address/blob/master/broadcast-address.js (MIT)
export const getBroadcastAddr = (networkInterface: string) => {
  const addr_info = os
    .networkInterfaces()
    [networkInterface].find(e => e.family === 'IPv4');

  if (!addr_info)
    throw new Error(`Unable to get addr_info for ${networkInterface}`);

  const addr_splitted = addr_info.address.split('.');
  const netmask_splitted = addr_info.netmask.split('.');

  // bitwise OR over the splitted NAND netmask, then glue them back together with a dot character to form an ip
  // we have to do a NAND operation because of the 2-complements; getting rid of all the 'prepended' 1's with & 0xFF
  return addr_splitted
    .map((e, i) => (~netmask_splitted[i] & 0xff) | (e as any))
    .join('.');
};

// simplified version of https://github.com/futomi/node-lifx-lan/blob/master/lib/lifx-lan-composer.js (MIT)
export const mkLifxMsg = (type: number, payload?: Buffer) => {
  // frame
  // https://lan.developer.lifx.com/docs/header-description#frame
  const frame = Buffer.alloc(8);
  const protocol = 1024;
  const origin = 0;
  const tagged = 1;
  const addressable = 1;

  frame.writeUInt16LE(0, 0); // size will be filled in later
  frame.writeUInt16LE(
    protocol | (origin << 14) | (tagged << 13) | (addressable << 12),
    2,
  );
  frame.writeUInt32LE(1, 4);

  // frame address
  // https://lan.developer.lifx.com/docs/header-description#frame-address
  const frameAddress = Buffer.alloc(16);
  const ackRequired = 0;
  const resRequired = 1;

  frameAddress.writeUInt8((ackRequired << 1) | resRequired, 14);

  // protocol header
  // https://lan.developer.lifx.com/docs/header-description#protocol-header
  const protocolHeader = Buffer.alloc(12);
  protocolHeader.writeUInt16LE(type, 8);

  const buffers = [frame, frameAddress, protocolHeader];
  if (payload) buffers.push(payload);

  const msg = Buffer.concat(buffers);

  // finally write the size
  msg.writeUInt16LE(msg.length, 0);

  return msg;
};
