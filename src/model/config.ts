import { DeviceCustomizationConfig } from "./device-customization-config";
import { PlatformConfig } from "homebridge";

export interface Config extends PlatformConfig{
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  devicesCustomization: DeviceCustomizationConfig[]
}