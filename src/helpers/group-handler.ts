import {Group} from '../model/myfox-api/group'
import {Device} from '../model/myfox-api/device'


export default function isGroup(myfoxDevice: Group | Device) : myfoxDevice is Group {
     return (myfoxDevice as Group).groupId !== undefined;
  }
