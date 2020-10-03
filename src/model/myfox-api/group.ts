import { Device } from './device';

export interface Group {
  groupId: string;
  label: string;
  type: string;
  devices: Device[];
}