import { cosmiconfig } from 'cosmiconfig'
import { AppConfig, throwDecoder } from './types';

const explorer = cosmiconfig("homectl");

export const loadConfig = async () => {
  const result = await explorer.search();

  if (!result) throw new Error("Unable to find homectl config file")
  const { config, filepath } = result

  console.log(`Using configuration file: ${filepath}`)
  console.log('Decoding config...')

  return throwDecoder(AppConfig.decode(config), `Error while decoding config, quitting...`)
}