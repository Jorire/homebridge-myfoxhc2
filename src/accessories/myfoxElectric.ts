import { CharacteristicEventTypes } from 'homebridge';
import type { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback} from 'homebridge';
import { MyfoxHC2Plugin } from '../platform';
import { Site } from '../model/myfox-api/site';
import { MyfoxAPI } from '../myfoxAPI';
import { Device } from '../model/myfox-api/device';
import { Group } from '../model/myfox-api/group';

import isGroup from '../helpers/group-handler'

export class MyfoxElectric{
  private service: Service;
  private device: Device | Group;
  private inUse: boolean = false;

  constructor(
    private readonly platform: MyfoxHC2Plugin,
    private readonly myfoxAPI: MyfoxAPI,
    private site: Site,
    private readonly accessory: PlatformAccessory,
  ) {
      //Get context
      this.device = accessory.context.device;
      if(isGroup(this.device)){
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
          .setCharacteristic(this.platform.Characteristic.Manufacturer, this.site.brand)
          .setCharacteristic(this.platform.Characteristic.Model, 'Electric Group')
          .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.site.siteId}-${this.device.groupId}`);
      }else{
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
          .setCharacteristic(this.platform.Characteristic.Manufacturer, this.site.brand)
          .setCharacteristic(this.platform.Characteristic.Model, this.device.modelLabel)
          .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.site.siteId}-${this.device.deviceId}`);
      }

      this.service = this.accessory.getService(this.platform.Service.Outlet) ?? this.accessory.addService(this.platform.Service.Outlet);
      this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.label);
      
      this.service.getCharacteristic(this.platform.Characteristic.On)
      .on(CharacteristicEventTypes.GET, this.getCurrentState.bind(this))
      .on(CharacteristicEventTypes.SET, this.setTargetState.bind(this));

      this.service.getCharacteristic(this.platform.Characteristic.OutletInUse)
            .on(CharacteristicEventTypes.GET, this.getCurrentState.bind(this));

  }

  setTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
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
}