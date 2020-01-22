import os from 'os';

export const getBroadcastAddr = (networkInterface: string) => {
  const addr_info = os.networkInterfaces()[networkInterface].find(e => e.family === 'IPv4');

  if (!addr_info)
    throw new Error(`Unable to get addr_info for ${networkInterface}`);

  const addr_splitted = addr_info.address.split('.');
  const netmask_splitted = addr_info.netmask.split('.');

  // bitwise OR over the splitted NAND netmask, then glue them back together with a dot character to form an ip
  // we have to do a NAND operation because of the 2-complements; getting rid of all the 'prepended' 1's with & 0xFF
  return addr_splitted.map((e, i) => (~netmask_splitted[i] & 0xFF) | e as any).join('.');
};
