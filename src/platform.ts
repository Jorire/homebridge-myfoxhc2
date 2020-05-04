import { APIEvent } from 'homebridge';
import type { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { MyfoxAPI } from './myfoxAPI';
import cron from "node-cron"; //TODO remove for debug only
import { MyfoxSecuritySystem } from './accessories/myfoxSecuritySystem';
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class MyfoxHC2Plugin implements DynamicPlatformPlugin {
  public readonly Service = this.api.hap.Service;
  public readonly Characteristic = this.api.hap.Characteristic;
  public readonly myfoxAPI : MyfoxAPI;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.myfoxAPI = new MyfoxAPI(this.log, this.config);
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {      
      // All cached accessories restored discover new MyFox sites and devices
      this.log.info('Discover Myfox sites');
      this.discoverMyfoxSites();
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
    //DEVEL !!!
    while(this.accessories.length > 0) {
      let accessory = this.accessories.pop();
      if(accessory){
        this.log.info('Unregister Site', accessory.displayName, accessory.UUID);          
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);   
      }
    }
    try{
      const sites = await this.myfoxAPI.getSites();
      //Register new sites
      sites.forEach(site => {
        const uuid = this.api.hap.uuid.generate(`Myfox-${site.siteId}`);
        if (!this.accessories.find(accessory => accessory.UUID === uuid)) {
          //If not already defined
          //Create new accessory
          const accessory = new this.api.platformAccessory(site.label, uuid);          
          accessory.context.device = site;
          new MyfoxSecuritySystem(this, this.myfoxAPI, accessory);            
          //Register
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.accessories.push(accessory);
          this.log.info('Register Site', accessory.displayName, accessory.UUID);          
        }else{
          this.log.info('Already registered Site', site.label, uuid); 
        }
      });

      //Unregister old sites
      this.accessories.forEach(accessory =>{
        if (!sites.find(site => {const uuid =  this.api.hap.uuid.generate(`Myfox-${site.siteId}`); return uuid === accessory.UUID })) {
          this.log.info('Unregister Site', accessory.displayName, accessory.UUID);          
          this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);        
        }
      });
    }catch(error){
      this.log.error(error)
    }   
  }
}
