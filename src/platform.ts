import { APIEvent } from 'homebridge';
import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { MyfoxAPI } from './myfoxAPI';
import { MyfoxSecuritySystem } from './accessories/myfox-security-system';
import isGroup from './helpers/group-handler';
import { MyfoxElectric } from './accessories/myfox-electric';
import { MyfoxTemperatureSensor } from './accessories/myfox-temperature-sensor';
import { MyfoxScenario } from './accessories/myfox-scenario';
import { MyfoxShutter } from './accessories/myfox-shutter';
import { IftttMessage } from './model/ifttt/ifttt-message';
import { Site } from './model/myfox-api/site';
import { DeviceCustomizationConfig } from './model/device-customization-config';
import http = require('http');


let myfoxHC2Plugin: MyfoxHC2Plugin;

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class MyfoxHC2Plugin implements DynamicPlatformPlugin {
  public readonly Service = this.api.hap.Service;
  public readonly Characteristic = this.api.hap.Characteristic;
  public readonly myfoxAPI: MyfoxAPI;
  private debug: boolean;
  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public discoveredAccessories: PlatformAccessory[] = [];
  public sites: MyfoxSecuritySystem[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.myfoxAPI = new MyfoxAPI(this.log, this.config);
    this.debug = (config.debug?.debug) ? config.debug.debug : false;
    myfoxHC2Plugin = this;
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      // All cached accessories restored discover new MyFox sites and devices
      this.log.info('Discover Myfox sites');
      this.discoverMyfoxSites();
      if (this.config.ifttt?.active) {
        this.listenIFTTTWebhooks();
      }
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Restoring accessory from cache:', accessory.displayName, accessory.UUID);
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverMyfoxSites() {

    try {
      const sitesDiscovered = await this.myfoxAPI.getSites();
      //Register new sites
      for (const site of sitesDiscovered) {
        const uuid = this.api.hap.uuid.generate(`Myfox-${site.siteId}`);
        let accessory = this.accessories.find(accessory => accessory.UUID.localeCompare(uuid) === 0);
        if (!accessory) {
          //If not already defined
          //Create new Site/Alarm
          accessory = new this.api.platformAccessory(site.label, uuid);
          this.log.info('\tSite / Alarm', 'new', site.siteId, site.label, uuid);
        } else {
          this.log.info('\tSite / Alarm', 'existing', site.siteId, site.label, uuid);
        }

        accessory.context.device = site;
        this.sites.push(new MyfoxSecuritySystem(this, this.myfoxAPI, accessory));
        //Add to discovered devices
        this.discoveredAccessories.push(accessory);

        await this.discoverElectrics(site);
        await this.discoverTemperatureSensors(site);
        await this.discoverScenarios(site);
        await this.discoverShutters(site);
      }

      //Swap missing discovered accessory to accessory list
      this.discoveredAccessories.forEach(accessory => {
        const found = this.accessories.find(acc => acc.UUID.localeCompare(accessory.UUID) === 0);
        if (!found) {
          //Register
          this.log.info('Register Device', accessory.displayName, accessory.UUID);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.push(accessory);
        }
      });

      //Unregister old accessories
      this.accessories.forEach(accessory => {
        const found = this.discoveredAccessories.find(acc => acc.UUID.localeCompare(accessory.UUID) === 0);
        if (!found) {
          this.log.info('Unregister Device/Site', accessory.displayName, accessory.UUID);
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
      });
      this.discoveredAccessories = [];
    } catch (error) {
      this.log.error(error);
    }
  }

  async discoverScenarios(site: Site) {
    try {
      const scenarios = await this.myfoxAPI.getScenarios(site.siteId);
      scenarios.forEach(device => {
        const uuid = this.api.hap.uuid.generate(`Myfox-${device.deviceId}`);

        const customConf = this.getDeviceCustomization(site.siteId, device.deviceId);
        let accessory = this.accessories.find(accessory => accessory.UUID.localeCompare(uuid) === 0);
        if (!customConf || !customConf.hidden) {
          if (!accessory) {
            //Create new accessory
            accessory = new this.api.platformAccessory(device.label, uuid);
            this.log.info('\tScenario', 'new', site.siteId, device.deviceId, device.label, uuid);
          } else {
            //Device already defined
            this.log.info('\tScenario', 'existing', site.siteId, device.deviceId, device.label, uuid);
          }

          accessory.context.device = device;
          new MyfoxScenario(this, this.myfoxAPI, site, accessory);
          //Add to discovered devices    
          this.discoveredAccessories.push(accessory);
        } else {
          //Device hidden
          this.log.info('\tScenario', 'hidden', site.siteId, device.deviceId, device.label, uuid);
        }
      });
    } catch (error) {
      this.log.error(error);
    }
  }

  async discoverElectrics(site: Site) {
    try {
      const electrics = await this.myfoxAPI.getElectrics(site.siteId);
      electrics.forEach(device => {
        let identifier;
        if (isGroup(device)) {
          identifier = device.groupId;
        } else {
          identifier = device.deviceId;
        }

        const uuid = this.api.hap.uuid.generate(`Myfox-${identifier}`);

        const customConf = this.getDeviceCustomization(site.siteId, identifier);
        let accessory = this.accessories.find(accessory => accessory.UUID.localeCompare(uuid) === 0);
        if (!customConf || !customConf.hidden) {
          const targetedService = MyfoxElectric.getTargetedService(this, customConf);
          if (!accessory) {
            //Create new accessory
            accessory = new this.api.platformAccessory(device.label, uuid);
            this.log.info('\tElectric device', 'new', site.siteId, identifier, device.label, uuid, isGroup(device)
              ? '[group]' : '[socket]', targetedService.name);
          } else {
            //Device already defined
            this.log.info('\tElectric device', 'existing', site.siteId, identifier, device.label, uuid);
          }
          accessory.context.device = device;
          new MyfoxElectric(this, this.myfoxAPI, site, accessory, customConf, targetedService);
          //Add to discovered devices    
          this.discoveredAccessories.push(accessory);
        } else {
          //Device hidden
          this.log.info('\tElectric device', 'hidden', site.siteId, identifier, device.label, uuid);
        }
      });
    } catch (error) {
      this.log.error(error);
    }
  }

  async discoverShutters(site: Site) {
    try {
      const shutters = await this.myfoxAPI.getShutters(site.siteId);
      shutters.forEach(device => {
        let identifier;
        if (isGroup(device)) {
          identifier = device.groupId;
        } else {
          identifier = device.deviceId;
        }

        const uuid = this.api.hap.uuid.generate(`Myfox-${identifier}`);

        const customConf = this.getDeviceCustomization(site.siteId, identifier);
        let accessory = this.accessories.find(accessory => accessory.UUID.localeCompare(uuid) === 0);
        if (!customConf || !customConf.hidden) {
          if (!accessory) {
            //Create new accessory
            accessory = new this.api.platformAccessory(device.label, uuid);
            this.log.info('\tShutters device', 'new', site.siteId, identifier, device.label, uuid, isGroup(device)
              ? '[group]' : '[socket]');
          } else {
            //Device already defined
            this.log.info('\tShutters device', 'existing', site.siteId, identifier, device.label, uuid);
          }
          accessory.context.device = device;
          new MyfoxShutter(this, this.myfoxAPI, site, accessory);
          //Add to discovered devices    
          this.discoveredAccessories.push(accessory);
        } else {
          //Device hidden
          this.log.info('\tShutters device', 'hidden', site.siteId, identifier, device.label, uuid);
        }
      });
    } catch (error) {
      this.log.error(error);
    }
  }


  async discoverTemperatureSensors(site: Site) {
    try {
      const tsensors = await this.myfoxAPI.getTemperatureSensors(site.siteId);
      tsensors.forEach(device => {
        const identifier = device.deviceId;

        const uuid = this.api.hap.uuid.generate(`Myfox-${identifier}`);

        const customConf = this.getDeviceCustomization(site.siteId, identifier);
        let accessory = this.accessories.find(accessory => accessory.UUID.localeCompare(uuid) === 0);
        if (!customConf || !customConf.hidden) {
          if (!accessory) {
            //Create new accessory
            accessory = new this.api.platformAccessory(device.label, uuid);
            this.log.info('\tTemperature sensor', 'new', site.siteId, identifier, device.label, uuid);
          } else {
            //Device already defined
            this.log.info('\tTemperature sensor', 'existing', site.siteId, identifier, device.label, uuid);
          }
          accessory.context.device = device;
          new MyfoxTemperatureSensor(this, this.myfoxAPI, site, accessory);
          this.discoveredAccessories.push(accessory);
        } else {
          //Device hidden
          this.log.info('\tTemperature sensor', 'hidden', site.siteId, identifier, device.label, uuid);
        }
      });
    } catch (error) {
      this.log.error(error);
    }
  }

  private getDeviceCustomization(siteId: string, deviceId: string): DeviceCustomizationConfig | undefined {
    const customizedDevices = this.config.devicesCustomization;
    if (Array.isArray(customizedDevices)) {
      const cc: DeviceCustomizationConfig | undefined = customizedDevices.find(conf => {
        return conf.deviceId.localeCompare(deviceId) === 0 && conf.siteId.localeCompare(siteId) === 0;
      });
      if (cc) {
        if (this.debug) {
          this.log.debug('Find customized device configuration', siteId, deviceId, cc);
        }
      }
      return cc;
    } else {
      return undefined;
    }
  }

  private listenIFTTTWebhooks() {
    if (this.config.ifttt && this.config.ifttt.active) {
      const port = this.config.ifttt.port;
      http.createServer(this.handleIFTTTRequest)
        .listen(port, '0.0.0.0');
      this.log.info('Listenning IFTTT webhooks on port \'%s\'.', port);
    }
  }

  private handleIFTTTRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    myfoxHC2Plugin.log.info('HTTP request Incoming');
    if (myfoxHC2Plugin.debug) {
      myfoxHC2Plugin.log.debug(' => Headers:', req.headers);
    }
    if (myfoxHC2Plugin.validateCredentials(req)) {
      if (myfoxHC2Plugin.debug) {
        myfoxHC2Plugin.log.debug('Credentials valid');
      }
      const data: any[] = [];
      req.on('data', chunk => {
        data.push(chunk);
      });
      req.on('end', () => {
        try {
          const body: string = Buffer.concat(data).toString();
          if (myfoxHC2Plugin.debug) {
            myfoxHC2Plugin.log.debug(' => Body:', body);
          }
          const message: IftttMessage = JSON.parse(body);

          if (myfoxHC2Plugin.debug) {
            myfoxHC2Plugin.log.debug(' => Parsed message:', message);
          }
          if (message.site) {
            //Find targeted site
            const s = myfoxHC2Plugin.sites.find(s => s.site.label.localeCompare(message.site) === 0);
            if (s) {
              s.handleIftttMessage(message);
            } else {
              myfoxHC2Plugin.log.warn('HTTP request not processed. Site not found', message);
            }
          } else {
            //Dispatch to all sites
            myfoxHC2Plugin.sites.forEach(s => s.handleIftttMessage(message));
          }
          res.statusCode = 200;
          res.end('{ "status": "ok" }');
        } catch (error) {
          myfoxHC2Plugin.log.error('Error parsing HTTP request body', error);
          res.statusCode = 422;
          res.end('{ "status": "ko" }');
        }
      });
    } else {
      myfoxHC2Plugin.log.error('HTTP request not authorized', req.headers.authorization);
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', 'Basic realm="Secure Area"');
      res.end('Not authorized');
    }
  }

  private validateCredentials(req: http.IncomingMessage): boolean {
    const user = myfoxHC2Plugin.config.ifttt.httpAuthUser;
    const password = myfoxHC2Plugin.config.ifttt.httpAuthPassword;
    const auth = req.headers.authorization;
    if (!auth) {
      return false;
    } else {
      const regexp = '^(.*):(.*)$';
      const token = auth.split(/\s+/).pop() || '';
      const parts = Buffer.from(token, 'base64').toString().match(regexp);
      if (parts?.length === 3) {
        return parts[1].localeCompare(user) === 0 && parts[2].localeCompare(password) === 0;
      } else {
        return false;
      }
    }
  }
}
