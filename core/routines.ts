import * as t from 'io-ts';

import {
  PluginProps,
  RoutineConfig,
  RoutinesConfig,
  throwDecoder,
  SensorUpdate,
} from '../types';
import { HomectlPlugin } from '../plugins';

const Config = RoutinesConfig;
type Config = t.TypeOf<typeof Config>;

interface Sensors {
  [path: string]: unknown;
}

// TODO: split into sensors & routines?
/**
 * Routines plugin
 *
 * Handles sensor changes, triggering configured routines if necessary
 */

export default class RoutinesPlugin extends HomectlPlugin<Config> {
  routines: RoutinesConfig = {};
  knownSensors: Sensors = {};

  constructor(props: PluginProps<Config>) {
    super(props, Config);
  }

  async register() {
    this.routines = this.config;

    this.app.on('registerSensor', (msg: unknown) => {
      const sensorId = throwDecoder(t.string)(
        msg,
        'Unable to decode registerSensor message',
      );
      this.knownSensors[sensorId] = false;
      this.log(`Discovered sensor "${sensorId}"`);
    });
  }

  async handleMsg(path: string, payload: unknown) {
    const cmd = path;

    switch (cmd) {
      case 'valueChange': {
        // this.log(`Got valueChange msg: `, payload);
        const sensorUpdate = throwDecoder(SensorUpdate)(
          payload,
          'Unable to decode valueChange payload',
        );
        this.handleValueChange(sensorUpdate);
        break;
      }
      default:
        this.log(`Unknown command received: ${cmd}`);
    }
  }

  async handleValueChange(sensorUpdate: SensorUpdate) {
    for (const [routineName, routine] of Object.entries(this.routines)) {
      // First check if this sensorUpdate affects looped routine
      if (!this.isRoutineMatch(sensorUpdate, routine)) continue;

      const wasTriggered = this.isRoutineTriggered(this.knownSensors, routine);
      const wouldBeTriggered = this.isRoutineTriggered(
        {
          ...this.knownSensors,
          [sensorUpdate.path]: sensorUpdate.value,
        },
        routine,
      );

      // Only trigger routine if it wasn't triggered before
      if (!wasTriggered && wouldBeTriggered) {
        this.log(`Triggering routine ${routineName}`);
        for (const action of routine.do) {
          const [path, ...payload] = action.split(' ');
          await this.sendMsg(
            path,
            t.unknown,
            payload.length === 1 ? payload[0] : payload,
          );
        }
      }
    }

    this.knownSensors = {
      ...this.knownSensors,
      [sensorUpdate.path]: sensorUpdate.value,
    };
  }

  /**
   * Returns true if given sensorUpdate matches any of given routine's conditions
   */
  isRoutineMatch(sensorUpdate: SensorUpdate, routine: RoutineConfig) {
    return Boolean(
      routine.when.find(condition => {
        if (
          condition.path === sensorUpdate.path &&
          condition.is === sensorUpdate.value
        )
          return true;
        return false;
      }),
    );
  }

  /**
   * Checks all conditions of routine, if matching sensor with matching value is found the routine is considered triggered
   */
  isRoutineTriggered(sensors: Sensors, routine: RoutineConfig) {
    for (const condition of routine.when) {
      const sensor = sensors[condition.path];
      if (sensor === undefined) {
        this.log(`Unknown sensor with path ${condition.path}`);
        return false;
      }
      if (condition.is !== sensor) {
        return false;
      }
    }

    return true;
  }
}
