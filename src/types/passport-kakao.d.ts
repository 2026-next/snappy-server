declare module 'passport-kakao' {
  import * as oauth2 from 'passport-oauth2';

  export class Strategy extends oauth2.Strategy {
    constructor(options: any, verify?: (...args: any[]) => void);
  }

  export default Strategy;
}
