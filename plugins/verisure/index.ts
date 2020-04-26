import * as t from 'io-ts';
import axios from 'axios';
import jwtDecode from 'jwt-decode'

import { PluginProps } from '../../types';
import { HomectlPlugin } from '../../plugins';

const Config = t.type({
  plugin: t.literal('verisure'),
  username: t.string,
  password: t.string,
});
type Config = t.TypeOf<typeof Config>;

/**
 * Verisure plugin
 *
 * Poll the Verisure API for alarm state changes
 */

export default class VerisurePlugin extends HomectlPlugin<Config> {
  usernameCookie = '';
  vidCookie = '';
  accessTokenCookie = '';
  refreshTokenCookie = '';
  giid = '';
  armStatus?: string;
  path = '';

  constructor(props: PluginProps<Config>) {
    super(props, Config);

    this.path = `integrations/${this.id}/armStatus`;
  }

  async register() {
    // TODO: consider calling this.doLogin once per hour?
    await this.doLogin();
    setTimeout(this.doRefreshToken, 60 * 1000)
    this.doPollStatus();

    this.app.emit('registerSensor', this.path)
  }

  doLogin = async () => {
    // this gets the JSESSIONID cookie needed for next step
    const jSpringSecurityCheck = await axios({
      url: 'https://mypages.verisure.com/j_spring_security_check',
      method: 'POST',
      data: `j_username=${encodeURIComponent(this.config.username)}&j_password=${encodeURIComponent(this.config.password)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      }
    })
    const jSessionIdCookie = jSpringSecurityCheck.headers["set-cookie"][0]

    // this gets the username and vid cookies needed for next steps
    const status = await axios({
      url: 'https://mypages.verisure.com/fi/status',
      method: 'GET',
      headers: { Cookie: jSessionIdCookie }
    })
    this.usernameCookie = status.headers["set-cookie"].find((cookie: string) => cookie.startsWith('username='))
    this.vidCookie = status.headers["set-cookie"].find((cookie: string) => cookie.startsWith('vid='))

    // this gets access/refresh tokens needed for accessing the graphql api
    const apiLogin = await axios({
      url: 'https://m-api01.verisure.com/auth/login',
      method: 'POST',
      headers: { Cookie: this.vidCookie }
    })

    this.accessTokenCookie = apiLogin.headers["set-cookie"].find((cookie: string) => cookie.startsWith('vs-access='));
    this.refreshTokenCookie = apiLogin.headers["set-cookie"].find((cookie: string) => cookie.startsWith('vs-refresh='));

    // decode the jwt and fetch the first key from vcp-prm.inst,
    // this is the "giid" which is needed in graphql queries
    const accessToken = apiLogin.data.accessToken
    const decodedAccessToken: any = jwtDecode(accessToken)
    const instDict = decodedAccessToken["vcp-prm"].inst
    const firstInstKey = Object.keys(instDict)[0]
    this.giid = firstInstKey
  }

  doRefreshToken = async () => {
    try {
      // console.log(Date.now(), 'refreshing Verisure access token')

      const refreshCookie = [this.usernameCookie, this.vidCookie, this.refreshTokenCookie].join('; ')

      const refresh = await axios({
        url: 'https://m-api01.verisure.com/auth/token',
        method: 'POST',
        headers: { Cookie: refreshCookie }
      })

      this.accessTokenCookie = refresh.headers["set-cookie"].find((cookie: string) => cookie.startsWith('vs-access='));
    } catch (e) {
      this.log('Error while refreshing Verisure access token:', e);
    } finally {
      setTimeout(this.doRefreshToken, 60 * 1000)
    }
  }

  doPollStatus = async () => {
    try {
      const statusCookie = [this.usernameCookie, this.vidCookie, this.accessTokenCookie].join('; ')

      const status = await axios({
        url: 'https://m-api01.verisure.com/graphql',
        method: 'POST',
        headers: { Cookie: statusCookie },
        data: [{
          operationName: 'ArmState',
          query: `query ArmState($giid: String!) {
            query: installation(giid: $giid) {
              armState {
                statusType
              }
            }
          }`,
          variables: { giid: this.giid }
        }]
      })

      // can be one of: "CHANGE_IN_PROGRESS", "DISARMED", "ARMED_HOME", "???"
      const armStatus = status.data.data.query.armState.statusType

      // console.log(Date.now(), { armStatus })
      this.setArmStatus(armStatus);
      setTimeout(this.doPollStatus, 1 * 1000)
    } catch (e) {
      this.log('Error while polling Verisure alarm:', e);
      setTimeout(this.doPollStatus, 60 * 1000)
    }
  }

  setArmStatus = (armStatus: string) => {
    // if this.armStatus is undefined we haven't learned the initial armStatus yet
    if (this.armStatus !== undefined && armStatus !== this.armStatus) {
      this.log('triggering valueChange with status', armStatus);
      this.sendMsg('routines/valueChange', t.unknown, {
        path: this.path,
        value: armStatus
      })
    }

    this.armStatus = armStatus;
  }
}

