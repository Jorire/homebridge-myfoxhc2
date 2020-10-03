import { Device } from './device';

export interface TemperatureSensor extends Device {
  lastTemperature: number;
  lastTemperatureAt: Date;
}