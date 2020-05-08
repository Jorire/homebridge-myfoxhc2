import { Logger, PlatformConfig } from 'homebridge';
import { Response, FetchError} from 'node-fetch'; 
import { Site } from './model/myfox-api/site';
import fetch from 'node-fetch';
import { Device } from './model/myfox-api/device';
import { Group } from './model/myfox-api/group';
import { Scenario } from './model/myfox-api/scenario';
import { TemperatureValue } from './model/myfox-api/temperature-value';
import { TemperatureSensor } from './model/myfox-api/temperature-sensor';

import isGroup from './helpers/group-handler'

export class MyfoxAPI{
  private readonly myfoxAPIUrl: string = 'https://api.myfox.me';
  private readonly site: number;
  private authToken: string; 
  private tokenExpiresIn: Date;
  private debugPlayload: boolean; 

  constructor(
      public readonly log: Logger,
      public readonly config: PlatformConfig,
  ) {
    this.authToken = '';
    this.tokenExpiresIn = new Date(0);    
    this.site = config.site;
    this.debugPlayload = config.debugMyfoxAPI ?config.debugMyfoxAPI : false;
  }  

  /**
   * Check HTTP status, throw an error if HTTP error
   * @param action: for logging purpose (action on error)
   * @param res: http response
   * @returns return an HTTP response if HTTP status in between 200 & 300
   */
  checkHttpStatus(action: string, res: Response): Response {
    if (res.ok) { 
      //if 200 <= HTTTP < 300
      return res;
    } else {        
      throw {action: action, status: res.status, statusText: res.statusText }; 
    }
  }
  
  /**
   * Debug Myfox API json playload
   * @param action 
   * @param json 
   */
  async getJSONPlayload(response: Response): Promise<any>{
    const body = await response.text();
    try{
      let object : any = JSON.parse(body);
      if(this.debugPlayload){
        this.log.debug('[MyfoxAPI] parse JSON result', JSON.stringify(object));
      }    
      return object;
    }catch(error){
      this.log.error('[MyfoxAPI] parse JSON result', body);
      throw( error );
    }    
  }

  /**
   * Check HTTP status, throw an error if HTTP error
   * @param action: for logging purpose (action on error)
   * @param res: http response
   * @returns return payload or throw an error if API status is invalid
   */
  getAPIPayload(action: string, json: any): any {
    if (json.status === 'OK') { 
      return json.payload;
    } else {        
      throw {action: action, status: json.status, payload: json }; 
    }
  }

  /**
   * Get a valid auth token
   * Error thrown token can't be acquired²
   * @returns authentication token as promise 
   */
  private getAuthtoken(): Promise<string>{
    if(!this.config.refreshToken){
      return Promise.reject('[Configuration] missing refresh token');
    }
    if(!this.config.clientId){
      return Promise.reject('[Configuration] missing client id');
    }
    if(!this.config.clientSecret){
      return Promise.reject('[Configuration] missing client secret');
    }

    if(this.tokenExpiresIn < new Date()){
      //Current Auth token is expired
      //Get a new one using myfox API
      const method = 'POST';
      const headers = {
        'Authorization': 'Basic ' + Buffer.from(this.config.clientId + ':' + this.config.clientSecret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      const body = `grant_type=refresh_token&refresh_token=${this.config.refreshToken}`;

      this.log.debug("[MyfoxAPI] getAuthtoken");
      return fetch(`${this.myfoxAPIUrl}/oauth2/token`, { method: method, headers: headers, body: body})
        .then((res: Response)=> this.checkHttpStatus('getAuthtoken', res))
        .then((res: Response)=> this.getJSONPlayload(res))
        .then((json: any) => {
          this.authToken = json.access_token;
          this.config.refreshToken = json.refresh_token;
          this.tokenExpiresIn = new Date();
          this.tokenExpiresIn.setSeconds(+(this.tokenExpiresIn.getSeconds()) + json.expires_in);
        })
        .then(() => this.authToken);
    } else {
      // refresh not needed, return current auth token
      return new Promise((successCallback) => {
        successCallback(this.authToken);
      });
    } 
  }


  /***
   * Alarm
   */

  /**
   * Get sites
   * @returns array of Myfox sites according to client credentials (clientId & clientSecret)
   */
  public async getSites(): Promise<Site[]>{    
    const authToken = await this.getAuthtoken();
    this.log.debug("[MyfoxAPI] getSites");
    return fetch(`${this.myfoxAPIUrl}/v2/client/site/items?access_token=${authToken}`)
        .then((res: Response) => this.checkHttpStatus('getSites', res))
        .then((res: Response) => this.getJSONPlayload(res))
        .then((json: any) => this.getAPIPayload('getSites', json).items);
  }

  /**
   * Get Alarm State
   */
  public async getAlarmState(siteId: string) {
    const authToken = await this.getAuthtoken();
    this.log.debug("[MyfoxAPI] getAlarmState", siteId);
    return fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/security?access_token=${authToken}`)
              .then((res: Response) => this.checkHttpStatus('getSites', res))
              .then((res: Response) => this.getJSONPlayload(res))
              .then((json: any) => this.getAPIPayload('getAlarmState', json));
  }  
  
  /**
  * Set Alarm State
  */
 public async setAlarmState(siteId: string, securityLevel: string) {
    const method = 'POST';
    const authToken = await this.getAuthtoken();
    
    this.log.debug("[MyfoxAPI] setAlarmState", siteId, securityLevel);
    return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/security/set/${securityLevel}?access_token=${authToken}`,  { method: method })
              .then((res: Response) => this.checkHttpStatus('setAlarmState', res))
              .then((res: Response) => this.getJSONPlayload(res))
              .then((json: any) => this.getAPIPayload('setAlarmState', json));
 }

  /***
   * Outlet / Electric group
   */
  public getElectrics(siteId: string): Promise<(Device|Group)[]>{
    return  Promise.all([this.getElectricsDevices(siteId), this.getElectricsGroups(siteId)])
                .then(arrResults => [...arrResults[0], ...arrResults[1]]);

  }

  public async getElectricsDevices(siteId: string): Promise<Device[]>{
    const authToken = await this.getAuthtoken();
    
    this.log.debug("[MyfoxAPI] getElectricsDevices", siteId);
    return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/device/socket/items?access_token=${authToken}`)
              .then((res: Response) => this.checkHttpStatus('getElectricsDevices', res))
              .then((res: Response) => this.getJSONPlayload(res))
              .then((json: any) => this.getAPIPayload('getElectricsDevices', json).items);
  }
  
  public async getElectricsGroups(siteId: string): Promise<Group[]>{
    const authToken = await this.getAuthtoken();
    
    this.log.debug("[MyfoxAPI] getElectricsGroup", siteId);
    return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/group/electric/items?access_token=${authToken}`)
              .then((res: Response) => this.checkHttpStatus('getElectricsGroup', res))
              .then((res: Response) => this.getJSONPlayload(res))
              .then((json: any) => this.getAPIPayload('getElectricsGroup', json).items);
  }

  public async switchElectric(siteId: string, device: Device|Group, on: boolean ){
    const method = 'POST';
    const state = on?'on':'off';

    const authToken = await this.getAuthtoken();
    if(isGroup(device)){
      this.log.debug("[MyfoxAPI] switchElectricGroup", siteId, device, on);
      return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/group/${device.groupId}/electric/${state}?access_token=${authToken}`,  { method: method })
                .then((res: Response) => this.checkHttpStatus('switchElectric', res))
                .then((res: Response) => this.getJSONPlayload(res))
                .then((json: any) => this.getAPIPayload('switchElectric', json));
    }else{
      this.log.debug("[MyfoxAPI] switchElectricDevice", siteId, device);
      return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/device/${device.deviceId}/socket/${state}?access_token=${authToken}`,  { method: method })
                .then((res: Response) => this.checkHttpStatus('switchElectric', res))
                .then((res: Response) => this.getJSONPlayload(res))
                .then((json: any) => this.getAPIPayload('switchElectric', json));
    }
  }

  /***
   * Temperature sensors
   */
  public async getTemperatureSensors(siteId: string): Promise<Device[]> {
    const authToken = await this.getAuthtoken();
    
    this.log.debug("[MyfoxAPI] getTemperatureSensors", siteId);
    return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/device/data/temperature/items?access_token=${authToken}`)
              .then((res: Response) => this.checkHttpStatus('getTemperatureSensors', res))
              .then((res: Response) => this.getJSONPlayload(res))
              .then((json: any) => this.getAPIPayload('getTemperatureSensors', json).items);
  }

  public async getTemperatures(siteId: string, device: Device): Promise<TemperatureValue[]> {
    const authToken = await this.getAuthtoken();
    this.log.debug("[MyfoxAPI] getTemperatures", siteId, device);
    return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/device/${device.deviceId}/data/temperature?access_token=${authToken}`)
              .then((res: Response) => this.checkHttpStatus('getTemperatures', res))
              .then((res: Response) => this.getJSONPlayload(res))
              .then((json: any) => this.getAPIPayload('getTemperatures', json).items);
  }
  
  public async getLastTemperature(siteId: string, device: Device): Promise<TemperatureSensor | undefined> {
    const authToken = await this.getAuthtoken();
    
    this.log.debug("[MyfoxAPI] getLastTemperature", siteId, device);
    
    return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/device/data/temperature/items?access_token=${authToken}`)
              .then((res: Response) => this.checkHttpStatus('getLastTemperature', res))
              .then((res: Response) => this.getJSONPlayload(res))
              .then((json: any) => <TemperatureSensor[]>(this.getAPIPayload('getTemperatureSensors', json).items))
              .then((tempSensors) => tempSensors.find(t => t.deviceId === device.deviceId));
  }

  /***
   * Scenario
   */
  public async getScenarios(siteId: string): Promise<Device[]> {
    const authToken = await this.getAuthtoken();
    
    this.log.debug("[MyfoxAPI] getTemperatureSensors", siteId);
    return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/scenario/items?access_token=${authToken}`)
              .then((res: Response) => this.checkHttpStatus('getScenarios', res))
              .then((res: Response) => this.getJSONPlayload(res))
              .then((json: any) => this.getAPIPayload('getScenarios', json).items)
              .then((items: Scenario[]) => {
                  let scenarios: Device[] = [];
                  items.forEach(sc =>{
                    if(sc.typeLabel.localeCompare('onDemand') === 0){
                      scenarios.push({deviceId: sc.scenarioId, label: sc.label, modelLabel: 'Scenario'});
                    }
                  });
                  return scenarios;
              });
  }

  public async playScenario(siteId: string, device: Device){
    const method = 'POST';
    const authToken = await this.getAuthtoken();
      this.log.debug("[MyfoxAPI] playScenario", siteId, device);
      return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/scenario/${device.deviceId}/play?access_token=${authToken}`,  { method: method })
                .then((res: Response) => this.checkHttpStatus('playScenario', res))
                .then((res: Response) => this.getJSONPlayload(res))
                .then((json: any) => this.getAPIPayload('playScenario', json));
  } 
  
  /***
  * Shutters
  */
  public getShutters(siteId: string): Promise<(Device|Group)[]>{
    return  Promise.all([this.getShuttersDevice(siteId), this.getShuttersGroup(siteId)])
                .then(arrResults => [...arrResults[0], ...arrResults[1]]);

  }

public async getShuttersDevice(siteId: string): Promise<Device[]>{
  const authToken = await this.getAuthtoken();
  
  this.log.debug("[MyfoxAPI] getShuttersDevice", siteId);
  return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/device/shutter/items?access_token=${authToken}`)
            .then((res: Response) => this.checkHttpStatus('getShuttersDevice', res))
            .then((res: Response) => this.getJSONPlayload(res))
            .then((json: any) => this.getAPIPayload('getShuttersDevice', json).items);
}

public async getShuttersGroup(siteId: string): Promise<Group[]>{
  const authToken = await this.getAuthtoken();
  
  this.log.debug("[MyfoxAPI] getShuttersGroup", siteId);
  return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/group/shutter/items?access_token=${authToken}`)
            .then((res: Response) => this.checkHttpStatus('getShuttersGroup', res))
            .then((res: Response) => this.getJSONPlayload(res))
            .then((json: any) => this.getAPIPayload('getShuttersGroup', json).items);
}

public async setShutterPosition(siteId: string, device: Device|Group, open: boolean ){
  const method = 'POST';
  const position = open ?'open':'close';
  const authToken = await this.getAuthtoken();
  if(isGroup(device)){
    this.log.debug("[MyfoxAPI] setShutterPosition", siteId, device, position);
    return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/group/${device.groupId}/shutter/${position}?access_token=${authToken}`,  { method: method })
              .then((res: Response) => this.checkHttpStatus('setShutterPosition', res))
              .then((res: Response) => this.getJSONPlayload(res))
              .then((json: any) => this.getAPIPayload('setShutterPosition', json));
  }else{
    this.log.debug("[MyfoxAPI] setShutterPosition", siteId, device, position);
    return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/device/${device.deviceId}/shutter/${position}?access_token=${authToken}`,  { method: method })
              .then((res: Response) => this.checkHttpStatus('setShutterPosition', res))
              .then((res: Response) => this.getJSONPlayload(res))
              .then((json: any) => this.getAPIPayload('setShutterPosition', json));
  }
}
}  