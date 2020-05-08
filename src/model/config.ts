import { ConfigDeviceCustomization } from "./config-device-customization";
import { PlatformConfig } from "homebridge";

export interface Config extends PlatformConfig{
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  devicesCustomization: ConfigDeviceCustomization[]
}