import { CharacteristicEventTypes, Characteristic } from 'homebridge';
import type { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback} from 'homebridge';

import { MyfoxHC2Plugin } from '../platform';
import { Site } from '../model/myfox-api/site';
import { MyfoxAPI } from '../myfoxAPI';

export class MyfoxSecuritySystem {
  private service: Service;
  private site: Site;
  constructor(
    private readonly platform: MyfoxHC2Plugin,
    private readonly myfoxAPI: MyfoxAPI,
    private readonly accessory: PlatformAccessory,
  ) {
    //Get context
    this.site = accessory.context.device;
    
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(Characteristic.Manufacturer, this.site.brand)
      .setCharacteristic(Characteristic.Model, 'HC2')
      .setCharacteristic(Characteristic.SerialNumber, this.site.siteId);
    
    this.service = this.accessory.getService(this.platform.Service.SecuritySystem) ?? this.accessory.addService(this.platform.Service.SecuritySystem);

    //Mandatory Characteristic
    this.service.setCharacteristic(Characteristic.Name, `Alarme ${this.site.label}`);

    const targetStates: number[] = [];
    targetStates.push(Characteristic.SecuritySystemTargetState.AWAY_ARM); 
    targetStates.push(Characteristic.SecuritySystemTargetState.NIGHT_ARM); 
    targetStates.push(Characteristic.SecuritySystemTargetState.DISARM); 

    this.service.getCharacteristic(Characteristic.SecuritySystemTargetState)
                .setProps({validValues: targetStates})
                .on(CharacteristicEventTypes.GET, this.getCurrentState.bind(this))
                .on(CharacteristicEventTypes.SET, this.setTargetState.bind(this));

    this.service.getCharacteristic(Characteristic.SecuritySystemCurrentState)
                .on(CharacteristicEventTypes.GET, this.getCurrentState.bind(this));
  }

  getCurrentState(callback: CharacteristicGetCallback) {
    this.myfoxAPI.getAlarmState(this.site.siteId)
                  .then(json => {
                    let state = undefined;
                    switch(json.statusLabel ){
                      case 'disarmed': 
                      state = Characteristic.SecuritySystemCurrentState.DISARMED;
                      break;

                      case 'partial': 
                      state = Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
                      break;

                      case 'armed': 
                      state = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
                      break;

                      default:
                        throw new Error("Unkown alarm status");
                    }
                    this.service.setCharacteristic(Characteristic.SecuritySystemCurrentState, state);    
                    callback(null, state) 
                  } )
                  .catch(error => {callback(error); this.platform.log.error(error);});
  }

  setTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    let state = undefined;
    switch(value ){
      case Characteristic.SecuritySystemCurrentState.DISARMED: 
      state = 'disarmed';
      break;

      case Characteristic.SecuritySystemCurrentState.NIGHT_ARM: 
      state = 'partial';
      break;

      case Characteristic.SecuritySystemCurrentState.AWAY_ARM: 
      state = 'armed';
      break;

      default:
        callback(new Error("Unkown alarm status"));
        throw new Error("Unkown alarm status");
    }
    this.myfoxAPI.setAlarmState(this.site.siteId, state)
                  .then(json => {
                    this.service.setCharacteristic(Characteristic.SecuritySystemCurrentState, value);    
                    callback(null) 
                  } )
                  .catch(error => {callback(error); this.platform.log.error(error)} );
  }
}