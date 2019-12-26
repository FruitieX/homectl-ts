import * as t from 'io-ts'
import { findFirst } from 'fp-ts/lib/Array'
import axios, { Method } from 'axios'

import { BridgeState, BridgeSceneSummary } from "./types";
import { PluginProps, throwDecoder } from "../../types";
import { HomectlPlugin } from '../../plugins';
import { pipe } from 'fp-ts/lib/pipeable';
import { fold } from 'fp-ts/lib/Option';
import { identity } from 'fp-ts/lib/function';

export const findHomectlScene = (bridgeState: BridgeState) =>
  pipe(
    findFirst(
      ([key, scene]: [string, BridgeSceneSummary]) => scene.name === 'homectl')(
        Object.entries(bridgeState.scenes)
      ),
    fold(() => undefined, ([key]) => key)
  )