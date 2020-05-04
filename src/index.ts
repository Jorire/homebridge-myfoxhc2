import type { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { MyfoxHC2Plugin } from './platform'; 

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, MyfoxHC2Plugin);
}
