export interface IftttMessage {
  site: string;
  action: string;
  state: string;
  type: string;
  device: string;
  timestamp: string;
}