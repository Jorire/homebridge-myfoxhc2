import { Logger, PlatformConfig } from 'homebridge';
import { Response} from 'node-fetch'; 
import { Site } from './model/myfox-api/site';
import fetch from 'node-fetch';
import { Device } from './model/myfox-api/device';
import { Group } from './model/myfox-api/group';

import isGroup from './helpers/group-handler'

export class MyfoxAPI{
  private readonly myfoxAPIUrl: string = 'https://api.myfox.me';
  private readonly site: number;
  private authToken: string; 
  private tokenExpiresIn: Date;

  constructor(
      public readonly log: Logger,
      public readonly config: PlatformConfig,
  ) {
    this.authToken = '';
    this.tokenExpiresIn = new Date(0);    
    this.site = config.site;
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
   * Check HTTP status, throw an error if HTTP error
   * @param action: for logging purpose (action on error)
   * @param res: http response
   * @returns return payload or throw an error if API status is invalid
   */
  getAPIPayload(action: string, json: any): any {
    if (json.status === 'OK') { 
      this.log.debug('[MyfoxAPI] getAPIPayload -', JSON.stringify(json.payload));
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

      return fetch(`${this.myfoxAPIUrl}/oauth2/token`, { method: method, headers: headers, body: body})
        .then((res: Response)=> this.checkHttpStatus('getAuthtoken', res))
        .then((res: Response)=> res.json())
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
        .then((res: Response) => res.json())
        .then((json: any) => this.getAPIPayload('getSites', json).items);
  }

  /**
   * Get Alarm State
   */
  public async getAlarmState(siteId: string) {
    const authToken = await this.getAuthtoken();
    this.log.debug("[MyfoxAPI] getAlarmState");
    return fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/security?access_token=${authToken}`)
              .then((res: Response) => this.checkHttpStatus('getSites', res))
              .then((res: Response) => res.json())
              .then((json: any) => this.getAPIPayload('getAlarmState', json));
  }  
  
  /**
  * Set Alarm State
  */
 public async setAlarmState(siteId: string, securityLevel: string) {
    const method = 'POST';
    const authToken = await this.getAuthtoken();
    
    this.log.debug("[MyfoxAPI] setAlarmState");
    return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/security/set/${securityLevel}?access_token=${authToken}`,  { method: method })
              .then((res: Response) => this.checkHttpStatus('setAlarmState', res))
              .then((res: Response) => res.json())
              .then((json: any) => this.getAPIPayload('setAlarmState', json));
 }

  /***
   * Outlet / Electric group
   */
  public getElectrics(siteId: string): Promise<(Device|Group)[]>{
    return  Promise.all([this.getOutlet(siteId), this.getElectricsGroup(siteId)])
                .then(arrResults => [...arrResults[0], ...arrResults[1]]);

  }

  public async getOutlet(siteId: string): Promise<Device[]>{
    const authToken = await this.getAuthtoken();
    
    this.log.debug("[MyfoxAPI] getOutlet");
    return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/device/socket/items?access_token=${authToken}`)
              .then((res: Response) => this.checkHttpStatus('getOutlet', res))
              .then((res: Response) => res.json())
              .then((json: any) => this.getAPIPayload('getOutlet', json).items);
  }
  
  public async getElectricsGroup(siteId: string): Promise<Group[]>{
    const authToken = await this.getAuthtoken();
    
    this.log.debug("[MyfoxAPI] getElectricsGroup");
    return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/group/electric/items?access_token=${authToken}`)
              .then((res: Response) => this.checkHttpStatus('getElectricsGroup', res))
              .then((res: Response) => res.json())
              .then((json: any) => this.getAPIPayload('getElectricsGroup', json).items);
  }

  public async switchElectric(siteId: string, device: Device|Group, on: boolean ){
    const method = 'POST';
    const state = on?'on':'off';

    const authToken = await this.getAuthtoken();
    if(isGroup(device)){
      this.log.debug("[MyfoxAPI] switchElectricGroup");
      return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/group/${device.groupId}/electric/${state}?access_token=${authToken}`,  { method: method })
                .then((res: Response) => this.checkHttpStatus('switchElectric', res))
                .then((res: Response) => res.json())
                .then((json: any) => this.getAPIPayload('switchElectric', json));
    }else{
      this.log.debug("[MyfoxAPI] switchElectricDevice");
      return  fetch(`${this.myfoxAPIUrl}/v2/site/${siteId}/device/${device.deviceId}/socket/${state}?access_token=${authToken}`,  { method: method })
                .then((res: Response) => this.checkHttpStatus('switchElectric', res))
                .then((res: Response) => res.json())
                .then((json: any) => this.getAPIPayload('switchElectric', json));
    }
  }
}  