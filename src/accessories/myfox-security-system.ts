import { CharacteristicEventTypes } from 'homebridge';
import type { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { MyfoxHC2Plugin } from '../platform';
import { Site } from '../model/myfox-api/site';
import { MyfoxAPI } from '../myfoxAPI';
import { IftttMessage } from '../model/ifttt/ifttt-message';

export class MyfoxSecuritySystem {
  private service: Service;
  public site: Site;
  constructor(
    private readonly platform: MyfoxHC2Plugin,
    private readonly myfoxAPI: MyfoxAPI,
    private readonly accessory: PlatformAccessory,
  ) {
    //Get context
    this.site = accessory.context.device;

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, this.site.brand)
      .setCharacteristic(this.platform.Characteristic.Model, 'HC2')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.site.siteId);

    this.service = this.accessory.getService(this.platform.Service.SecuritySystem)
      ?? this.accessory.addService(this.platform.Service.SecuritySystem);

    //Mandatory Characteristic
    this.service.setCharacteristic(this.platform.Characteristic.Name, `Alarme ${this.site.label}`);

    const targetStates: number[] = [];
    targetStates.push(this.platform.Characteristic.SecuritySystemTargetState.AWAY_ARM);
    targetStates.push(this.platform.Characteristic.SecuritySystemTargetState.NIGHT_ARM);
    targetStates.push(this.platform.Characteristic.SecuritySystemTargetState.DISARM);

    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .setProps({ validValues: targetStates })
      .on(CharacteristicEventTypes.GET, this.getCurrentState.bind(this))
      .on(CharacteristicEventTypes.SET, this.setTargetState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
      .on(CharacteristicEventTypes.GET, this.getCurrentState.bind(this));
  }

  getCurrentState(callback: CharacteristicGetCallback) {
    const hap = this.platform;
    const service = this.service;
    this.myfoxAPI.getAlarmState(this.site.siteId)
      .then(json => {
        let state = undefined;
        switch (json.statusLabel) {
          case 'disarmed':
            state = hap.Characteristic.SecuritySystemCurrentState.DISARMED;
            break;

          case 'partial':
            state = hap.Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
            break;

          case 'armed':
            state = hap.Characteristic.SecuritySystemCurrentState.AWAY_ARM;
            break;

          default:
            throw new Error('Unkown alarm status');
        }
        service.setCharacteristic(hap.Characteristic.SecuritySystemCurrentState, state);
        callback(null, state);
      })
      .catch(error => {
        callback(error); hap.log.error(error);
      });
  }

  setTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const hap = this.platform;
    const service = this.service;
    let state = undefined;
    switch (value) {
      case this.platform.Characteristic.SecuritySystemCurrentState.DISARMED:
        state = 'disarmed';
        break;

      case this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM:
        state = 'partial';
        break;

      case this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM:
        state = 'armed';
        break;

      default:
        callback(new Error('Unkown alarm status'));
        throw new Error('Unkown alarm status');
    }
    this.myfoxAPI.setAlarmState(this.site.siteId, state)
      .then(() => {
        service.setCharacteristic(hap.Characteristic.SecuritySystemCurrentState, value);
        callback(null);
      })
      .catch(error => {
        callback(error); hap.log.error(error);
      });
  }

  handleIftttMessage(message: IftttMessage) {
    if (message) {
      switch (message.action) {
        case 'alarm_state':
          {
            let targetState: number | undefined;
            switch (message.state) {
              case 'armed_night':
                targetState = this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
                break;

              case 'armed_away':
                targetState = this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM;
                break;

              case 'disarmed':
                targetState = this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;
                break;

              default:
                targetState = undefined;
                break;
            }
            if (targetState) {
              this.service.setCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState, targetState);
              this.platform.log.info('Security System current state changed', this.site.label, message.state);
            } else {
              this.platform.log.warn('IFTTT request not processed', message);
            }
          }
          break;
        case 'alarm_intrusion':
          this.service.setCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState,
            this.platform.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED);
          break;
        default:
          this.platform.log.warn('IFTTT request not processed', message);
          break;
      }
    } else {
      this.platform.log.warn('IFTTT request not processed', message);
    }
  }
}