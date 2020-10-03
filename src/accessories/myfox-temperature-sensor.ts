import { CharacteristicEventTypes } from 'homebridge';
import type { Service, PlatformAccessory, CharacteristicGetCallback } from 'homebridge';
import { MyfoxHC2Plugin } from '../platform';
import { Site } from '../model/myfox-api/site';
import { MyfoxAPI } from '../myfoxAPI';
import { Device } from '../model/myfox-api/device';

export class MyfoxTemperatureSensor {
  private service: Service;
  private device: Device;
  private temperature: number | undefined;


  constructor(
    private readonly platform: MyfoxHC2Plugin,
    private readonly myfoxAPI: MyfoxAPI,
    private site: Site,
    private readonly accessory: PlatformAccessory,
  ) {
    //Get context
    this.device = accessory.context.device;
    this.temperature = undefined;
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, this.site.brand)
      .setCharacteristic(this.platform.Characteristic.Model, this.device.modelLabel)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.site.siteId}-${this.device.deviceId}`);

    this.service = this.accessory.getService(this.platform.Service.TemperatureSensor)
      ?? this.accessory.addService(this.platform.Service.TemperatureSensor);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .on(CharacteristicEventTypes.GET, this.getCurrentTemperature.bind(this));
    this.service.updateCharacteristic(this.platform.Characteristic.StatusActive, false);
  }

  getCurrentTemperature(callback: CharacteristicGetCallback) {
    const self = this;
    this.myfoxAPI.getLastTemperature(this.site.siteId, this.device)
      .then((temperature) => {
        if (temperature) {
          self.temperature = temperature.lastTemperature;
          self.service.updateCharacteristic(self.platform.Characteristic.StatusFault, 0);
          self.service.updateCharacteristic(self.platform.Characteristic.StatusActive, true);
          callback(null, self.temperature);
        } else {
          self.temperature = undefined;
          self.service.updateCharacteristic(self.platform.Characteristic.StatusFault, 1);
          self.service.updateCharacteristic(self.platform.Characteristic.StatusActive, false);
        }
      })
      .catch(error => {
        self.service.updateCharacteristic(self.platform.Characteristic.StatusFault, 1);
        self.service.updateCharacteristic(self.platform.Characteristic.StatusActive, false);
        callback(error);
        self.platform.log.error(error);
      });

  }
}