import { CharacteristicEventTypes } from 'homebridge';
import type { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback,
  CharacteristicGetCallback } from 'homebridge';
import { MyfoxHC2Plugin } from '../platform';
import { Site } from '../model/myfox-api/site';
import { MyfoxAPI } from '../myfoxAPI';
import { Device } from '../model/myfox-api/device';
import { Group } from '../model/myfox-api/group';

import isGroup from '../helpers/group-handler';

export class MyfoxShutter {
  protected service: Service;
  protected device: Device | Group;
  protected currentPosition = 100;
  protected targetPosition = 100;

  constructor(
    protected readonly platform: MyfoxHC2Plugin,
    protected readonly myfoxAPI: MyfoxAPI,
    protected site: Site,
    protected readonly accessory: PlatformAccessory,
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
        .setCharacteristic(this.platform.Characteristic.Model, 'Shutter Group')
        .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.site.siteId}-${identifier}`);
    } else {
      this.accessory.getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(this.platform.Characteristic.Manufacturer, this.site.brand)
        .setCharacteristic(this.platform.Characteristic.Model, this.device.modelLabel)
        .setCharacteristic(this.platform.Characteristic.SerialNumber, `${this.site.siteId}-${identifier}`);
    }

    this.service = this.accessory.getService(this.platform.Service.WindowCovering)
      ?? this.accessory.addService(this.platform.Service.WindowCovering);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.device.label);

    this.service.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .on(CharacteristicEventTypes.GET, this.getTargetPosition.bind(this))
      .on(CharacteristicEventTypes.SET, this.setTargetPosition.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .on(CharacteristicEventTypes.GET, this.getCurrentPosition.bind(this));
  }

  getTargetPosition(callback: CharacteristicGetCallback) {
    callback(null, this.targetPosition);
  }

  setTargetPosition(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    const self = this;
    if (value > 50) {
      this.targetPosition = 100; //Open
    } else {
      this.targetPosition = 0; // Close
    }
    this.myfoxAPI.setShutterPosition(this.site.siteId, this.device, this.targetPosition === 100)
      .then(() => {
        setTimeout(self.endMove, 1000, self, self.targetPosition, callback);
      })
      .catch(error => {
        self.endMove(self, self.targetPosition, callback);
        self.platform.log.error(error);
      });
  }

  private endMove(mfShutter: MyfoxShutter, finalTarget: number, callback: any) {
    try {
      mfShutter.currentPosition = finalTarget;
      mfShutter.service.setCharacteristic(mfShutter.platform.Characteristic.CurrentPosition, mfShutter.currentPosition);
      callback(null, finalTarget);
    } catch (error) {
      mfShutter.platform.log.error(error); callback(error);
    }
  }

  getCurrentPosition(callback: CharacteristicGetCallback) {
    callback(null, this.currentPosition);
  }
}