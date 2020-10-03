import { CharacteristicEventTypes } from 'homebridge';
import type { Service, PlatformAccessory, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';
import { Device } from '../model/myfox-api/device';
import { MyfoxHC2Plugin } from '../platform';
import { MyfoxAPI } from '../myfoxAPI';
import { Site } from '../model/myfox-api/site';

export class MyfoxScenario {
  protected service: Service;
  protected device: Device;
  protected inUse = false;


  constructor(
    protected readonly platform: MyfoxHC2Plugin,
    protected readonly myfoxAPI: MyfoxAPI,
    protected site: Site,
    protected readonly accessory: PlatformAccessory,
  ) {
    //Get context
    this.device = accessory.context.device;

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, this.site.brand)
      .setCharacteristic(this.platform.Characteristic.Model, this.device.modelLabel)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.site.siteId}-${this.device.deviceId}`);

    this.service = this.accessory.getService(this.platform.Service.Switch) ?? this.accessory.addService(this.platform.Service.Switch);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.label);
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .on(CharacteristicEventTypes.GET, this.getCurrentState.bind(this))
      .on(CharacteristicEventTypes.SET, this.setTargetState.bind(this));
  }

  protected resetState(mfElect: MyfoxScenario) {
    if (mfElect) {
      mfElect.service.setCharacteristic(this.platform.Characteristic.On, false);
    }
  }

  setTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.inUse = JSON.parse(value.toString());
    if (this.inUse) {
      this.myfoxAPI.playScenario(this.site.siteId, this.device)
        .then(() => callback())
        .then(() => setTimeout(this.resetState, 500, this))
        .catch(error => {
          this.platform.log.error(error); callback(error);
        });
    } else {
      callback();
    }
  }

  getCurrentState(callback: CharacteristicGetCallback) {
    callback(null, this.inUse);
  }
}
