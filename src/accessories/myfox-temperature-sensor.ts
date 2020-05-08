import { CharacteristicEventTypes, WithUUID, Characteristic } from 'homebridge';
import type { Service, PlatformAccessory, CharacteristicSetCallback, CharacteristicGetCallback} from 'homebridge';
import { MyfoxHC2Plugin } from '../platform';
import { Site } from '../model/myfox-api/site';
import { MyfoxAPI } from '../myfoxAPI';
import { Device } from '../model/myfox-api/device';
import { Group } from '../model/myfox-api/group';
import { TemperatureValue } from '../model/myfox-api/temperature-value';

export class MyfoxTemperatureSensor{
  private service: Service;
  private device: Device;
  private temperature: number | undefined;
  private temperatureUpdatedAt: Date | undefined;


  constructor(
    private readonly platform: MyfoxHC2Plugin,
    private readonly myfoxAPI: MyfoxAPI,
    private site: Site,
    private readonly accessory: PlatformAccessory
  ) {
    //Get context
    this.device = accessory.context.device;
    this.temperature = undefined;
    this.temperatureUpdatedAt = undefined;
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
    .setCharacteristic(Characteristic.Manufacturer, this.site.brand)
    .setCharacteristic(Characteristic.Model, this.device.modelLabel)
    .setCharacteristic(Characteristic.SerialNumber, `${this.site.siteId}-${this.device.deviceId}`);

    this.service = this.accessory.getService(this.platform.Service.TemperatureSensor) ?? this.accessory.addService(this.platform.Service.TemperatureSensor);

    this.service.getCharacteristic(Characteristic.CurrentTemperature)
                .on(CharacteristicEventTypes.GET, this.getCurrentTemperature.bind(this));
    this.service.updateCharacteristic(Characteristic.StatusActive, false);
  }

  getCurrentTemperature(callback: CharacteristicGetCallback) {

    this.myfoxAPI.getLastTemperature(this.site.siteId, this.device)
                  .then((temperature) => {                    
                    if(temperature){
                      this.temperature = temperature.lastTemperature;
                      this.temperatureUpdatedAt = temperature.lastTemperatureAt;
                      this.service.updateCharacteristic(Characteristic.StatusFault, 0)
                      this.service.updateCharacteristic(Characteristic.StatusActive, true)
                      callback(null, this.temperature); 
                    }else{
                      this.temperature = undefined;
                      this.temperatureUpdatedAt = undefined;
                      this.service.updateCharacteristic(Characteristic.StatusFault, 1)
                      this.service.updateCharacteristic(Characteristic.StatusActive, false)
                    }
                  } )
                  .catch(error => {
                    this.service.updateCharacteristic(Characteristic.StatusFault, 1)
                    this.service.updateCharacteristic(Characteristic.StatusActive, false)
                    callback(error);
                    this.platform.log.error(error)
                  });
    
  }
}