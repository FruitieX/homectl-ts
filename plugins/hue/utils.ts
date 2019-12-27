import { findFirst } from 'fp-ts/lib/Array'
import { pipe } from 'fp-ts/lib/pipeable';
import { fold } from 'fp-ts/lib/Option';
import { flatten } from 'ramda';

import { BridgeState, BridgeSceneSummary, BridgeSensors, SensorEvent, ButtonType as ButtonId } from "./types";
import { SensorUpdate } from '../../types';

export const findHomectlScene = (bridgeState: BridgeState) =>
  pipe(
    findFirst(
      ([, scene]: [string, BridgeSceneSummary]) => scene.name === 'homectl')(
        Object.entries(bridgeState.scenes)
      ),
    fold(() => undefined, ([key]) => key)
  )

export const bridgeSensorsDiff = (pluginId: string) => (oldBridgeSensors: BridgeSensors, newBridgeSensors: BridgeSensors): Array<SensorUpdate> =>
  flatten(
    Object.entries(newBridgeSensors).filter(([key, newBridgeSensor]) => {
      const oldBridgeSensor = oldBridgeSensors[key]
      if (!oldBridgeSensor) return false;

      if (oldBridgeSensor.state.buttonevent !== newBridgeSensor.state.buttonevent) return true
      if (oldBridgeSensor.state.lastupdated !== newBridgeSensor.state.lastupdated) return true

      return false;
    }).map(([key, newBridgeSensor]) => {
      const oldBridgeSensor = oldBridgeSensors[key]
      const events = sensorEvents(oldBridgeSensor.state.buttonevent, newBridgeSensor.state.buttonevent)

      return events.map(event => ({
        path: `integrations/${pluginId}/${newBridgeSensor.name}/${event.id}`,
        value: event.value
      }))
    })
  )

// Because we have to poll for sensor events, we can miss out on some events.
// This function tries its best to guess what events may have been missed.
const sensorEvents = (oldButtonEvent: number | undefined, newButtonEvent: number | undefined): Array<SensorEvent> => {
  if (!oldButtonEvent || !newButtonEvent) return [{ id: "on" as const, value: false }]

  const oldButtonId = getButtonId(oldButtonEvent);
  const newButtonId = getButtonId(newButtonEvent);

  const oldState = getButtonState(oldButtonEvent)
  const newState = getButtonState(newButtonEvent)

  const events: Array<SensorEvent> = []

  // button ID and states remained unchanged but timestamp changed, assume we missed the first half of a button press/release (or release/press) cycle
  if (oldButtonId === newButtonId && oldState === newState) {
    events.push({ id: oldButtonId, value: !newState })
  }

  // button ID has changed and the old button state was left pressed, release it
  if (oldButtonId !== newButtonId && oldState === true) {
    events.push({ id: oldButtonId, value: false })
  }

  // button ID has changed and the new button state is released, assume we missed a button press event
  if (oldButtonId !== newButtonId && newState === false) {
    events.push({ id: newButtonId, value: true })
  }

  // push most recent button event last
  events.push({ id: newButtonId, value: newState })

  return events
}

const getButtonId = (buttonevent: number): ButtonId => {
  const str = buttonevent.toString()
  const id = str[0]

  switch (id) {
    case "1": return "on"
    case "2": return "dimUp"
    case "3": return "dimDown"
    case "4": return "off"
    default: return "on"
  }
}

const getButtonState = (buttonevent: number): boolean => {
  const str = buttonevent.toString()
  const buttonState = str[3]

  switch (buttonState) {
    case "0": return true // INITIAL_PRESSED
    case "1": return true // HOLD
    case "2": return false // SHORT_RELEASED
    case "3": return false // LONG_RELEASED
    default: return true
  }
}