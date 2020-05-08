import { CharacteristicEventTypes, WithUUID } from 'homebridge';
import type { Service, PlatformAccessory, CharacteristicSetCallback, CharacteristicGetCallback} from 'homebridge';
import { MyfoxHC2Plugin } from '../platform';
import { Site } from '../model/myfox-api/site';
import { MyfoxAPI } from '../myfoxAPI';
import { Device } from '../model/myfox-api/device';
import { Group } from '../model/myfox-api/group';

import isGroup from '../helpers/group-handler'
import { DeviceCustomizationConfig } from '../model/device-customization-config';

export class MyfoxElectric{
  private service: Service;
  private device: Device | Group;
  private inUse: boolean = false;

  constructor(
    private readonly platform: MyfoxHC2Plugin,
    private readonly myfoxAPI: MyfoxAPI,
    private site: Site,
    private readonly accessory: PlatformAccessory,
    targetService: WithUUID<typeof Service>
  ) {
      //Get context
      this.device = accessory.context.device;

      let identifier : string;
      if(isGroup(this.device)){
        identifier = this.device.groupId;
      }else{
        identifier = this.device.deviceId;
      }

      if(isGroup(this.device)){
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
          .setCharacteristic(this.platform.Characteristic.Manufacturer, this.site.brand)
          .setCharacteristic(this.platform.Characteristic.Model, 'Electric Group')
          .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.site.siteId}-${identifier}`);
      }else{
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
          .setCharacteristic(this.platform.Characteristic.Manufacturer, this.site.brand)
          .setCharacteristic(this.platform.Characteristic.Model, this.device.modelLabel)
          .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.site.siteId}-${identifier}`);
      }

      this.service = this.accessory.getService(targetService) ?? this.accessory.addService(targetService);
      this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.label);
      
      if(targetService === this.platform.Service.Outlet){
        this.service.getCharacteristic(this.platform.Characteristic.OutletInUse)
        .on(CharacteristicEventTypes.GET, this.getCurrentState.bind(this));
      }
      if(targetService === this.platform.Service.Fanv2){
        this.service.getCharacteristic(this.platform.Characteristic.Active)
        .on(CharacteristicEventTypes.GET, this.getCurrentState.bind(this));
      }

      this.service.getCharacteristic(this.platform.Characteristic.On)
      .on(CharacteristicEventTypes.GET, this.getCurrentState.bind(this))
      .on(CharacteristicEventTypes.SET, this.setTargetState.bind(this));
    
  }

  setTargetState(callback: CharacteristicSetCallback) {
    this.inUse = ! this.inUse;
    this.myfoxAPI.switchElectric(this.site.siteId, this.device, this.inUse)
                  .then(() => {
                    callback(null) 
                  } )
                  .catch(error => this.platform.log.error(error));
  }

  getCurrentState(callback: CharacteristicGetCallback) {
    callback(null, this.inUse); 
  }

  public static getTargetedService(platform: MyfoxHC2Plugin, customizedDeviceConf: DeviceCustomizationConfig | undefined): WithUUID<typeof Service> {
    if(customizedDeviceConf){
      switch(customizedDeviceConf.overrideType){
        case "Lightbulb":
          return platform.Service.Lightbulb;
        case "Switch":
          return platform.Service.Switch;
        case "Fan":
          return platform.Service.Fanv2;
        case "Outlet":
        default:
          return platform.Service.Outlet;
      }    
    }else{
      return platform.Service.Outlet;
    }
  }
}