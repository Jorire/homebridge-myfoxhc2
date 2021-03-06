import { CharacteristicEventTypes } from 'homebridge';
import type { Service, PlatformAccessory, WithUUID, CharacteristicValue,
  CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';
import { MyfoxHC2Plugin } from '../platform';
import { Site } from '../model/myfox-api/site';
import { MyfoxAPI } from '../myfoxAPI';
import { Device } from '../model/myfox-api/device';
import { Group } from '../model/myfox-api/group';

import isGroup from '../helpers/group-handler';
import { DeviceCustomizationConfig } from '../model/device-customization-config';

export class MyfoxElectric {
  protected service: Service;
  protected device: Device | Group;
  protected inUse = false;

  constructor(
    protected readonly platform: MyfoxHC2Plugin,
    protected readonly myfoxAPI: MyfoxAPI,
    protected site: Site,
    protected readonly accessory: PlatformAccessory,
    protected customizedDeviceConf: DeviceCustomizationConfig | undefined,
    protected targetService: WithUUID<typeof Service>,
  ) {
    //Get context
    this.device = accessory.context.device;

    let identifier: string;
    if (isGroup(this.device)) {
      identifier = this.device.groupId;
    } else {
      identifier = this.device.deviceId;
    }

    if (isGroup(this.device)) {
      this.accessory.getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(this.platform.Characteristic.Manufacturer, this.site.brand)
        .setCharacteristic(this.platform.Characteristic.Model, 'Electric Group')
        .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.site.siteId}-${identifier}`);
    } else {
      this.accessory.getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(this.platform.Characteristic.Manufacturer, this.site.brand)
        .setCharacteristic(this.platform.Characteristic.Model, this.device.modelLabel)
        .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.site.siteId}-${identifier}`);
    }
    this.service = this.accessory.getService(targetService) ?? this.accessory.addService(targetService);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.label);
    switch (targetService) {
      case this.platform.Service.Outlet:
        this.service.getCharacteristic(this.platform.Characteristic.On)
          .on(CharacteristicEventTypes.GET, this.getCurrentState.bind(this))
          .on(CharacteristicEventTypes.SET, this.setTargetState.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.OutletInUse)
          .on(CharacteristicEventTypes.GET, this.getCurrentState.bind(this));
        break;
      case this.platform.Service.Lightbulb:
      case this.platform.Service.Switch:
        this.service.getCharacteristic(this.platform.Characteristic.On)
          .on(CharacteristicEventTypes.GET, this.getCurrentState.bind(this))
          .on(CharacteristicEventTypes.SET, this.setTargetState.bind(this));
        break;
      case this.platform.Service.Fanv2:
        this.service.getCharacteristic(this.platform.Characteristic.Active)
          .on(CharacteristicEventTypes.GET, this.getCurrentState.bind(this))
          .on(CharacteristicEventTypes.SET, this.setTargetState.bind(this));
        break;
      default:
        throw new Error('Unkown service');
    }
  }

  protected resetState(mfElect: MyfoxElectric) {
    if (mfElect) {
      mfElect.service.setCharacteristic(this.platform.Characteristic.On, false);
    }
  }

  setTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const hap = this.platform;
    const self = this;
    this.inUse = JSON.parse(value.toString());
    if (this.customizedDeviceConf?.overrideType && this.customizedDeviceConf?.overrideType.localeCompare('Button') === 0) {
      if (this.inUse) {
        this.myfoxAPI.switchElectric(this.site.siteId, this.device, this.inUse)
          .then(() => callback())
          .then(() => setTimeout(self.resetState, 500, self))
          .catch(error => {
            hap.log.error(error); callback(error);
          });
      }
    } else {
      this.myfoxAPI.switchElectric(this.site.siteId, this.device, this.inUse)
        .then(() => callback())
        .catch(error => {
          hap.log.error(error); callback(error);
        });
    }
  }

  getCurrentState(callback: CharacteristicGetCallback) {
    callback(null, this.inUse);
  }

  public static getTargetedService(platform: MyfoxHC2Plugin, customizedDeviceConf: DeviceCustomizationConfig | undefined):
    WithUUID<typeof Service> {
    if (customizedDeviceConf && customizedDeviceConf.overrideType) {
      switch (customizedDeviceConf.overrideType) {
        case 'Lightbulb':
          return platform.Service.Lightbulb;
        case 'Button':
        case 'Switch':
          return platform.Service.Switch;
        case 'Fan':
          return platform.Service.Fanv2;
        case 'Outlet':
        default:
          return platform.Service.Outlet;
      }
    } else {
      return platform.Service.Outlet;
    }
  }
}