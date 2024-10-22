import * as t from 'io-ts';

export const BridgeLightState = t.type({
  on: t.boolean,
  bri: t.union([t.number, t.undefined]),
  hue: t.union([t.number, t.undefined]),
  sat: t.union([t.number, t.undefined]),
  transitiontime: t.union([t.number, t.undefined]),
  reachable: t.union([t.boolean, t.undefined]),
});
export type BridgeLightState = t.TypeOf<typeof BridgeLightState>;
export const BridgeLightStates = t.record(t.string, BridgeLightState);
export type BridgeLightStates = t.TypeOf<typeof BridgeLightStates>;
export const BridgeLight = t.type({
  state: BridgeLightState,
  name: t.string,
});
export type BridgeLight = t.TypeOf<typeof BridgeLight>;
export const BridgeLights = t.record(t.string, BridgeLight);
export type BridgeLights = t.TypeOf<typeof BridgeLights>;

export const BridgeSceneSummary = t.type({
  name: t.string,
});
export type BridgeSceneSummary = t.TypeOf<typeof BridgeSceneSummary>;
export const BridgeScenesSummary = t.record(t.string, BridgeSceneSummary);

export const BridgeSceneCreatedResponse = t.tuple([
  t.type({ success: t.type({ id: t.string }) }),
]);

export const BridgeLightSwitch = t.type({
  state: t.type({
    buttonevent: t.union([
      t.number,
      t.undefined,
      // null value observed when a new switch is added but no buttons were pressed yet
      t.null,
    ]),
    lastupdated: t.string,
  }),
  name: t.string,
  type: t.literal("ZLLSwitch"),
})
export type BridgeLightSwitch = t.TypeOf<typeof BridgeLightSwitch>;

export const BridgeMotionSensor = t.type({
  state: t.type({
    presence: t.boolean,
    lastupdated: t.string,
  }),
  name: t.string,
  type: t.literal("ZLLPresence"),
})
export type BridgeMotionSensor = t.TypeOf<typeof BridgeMotionSensor>;

export const BridgeGenericSensor = t.type({
  state: t.type({
    lastupdated: t.string,
  }),
  name: t.string,
  type: t.keyof({ Daylight: null, ZLLTemperature: null, ZLLLightLevel: null }),
})
export type BridgeGenericSensor = t.TypeOf<typeof BridgeGenericSensor>;

export const BridgeSensor = t.union([BridgeLightSwitch, BridgeMotionSensor, BridgeGenericSensor]);
export type BridgeSensor = t.TypeOf<typeof BridgeSensor>;

export const BridgeSensors = t.record(t.string, BridgeSensor);
export type BridgeSensors = t.TypeOf<typeof BridgeSensors>;

export const BridgeState = t.type({
  lights: BridgeLights,
  scenes: BridgeScenesSummary,
  sensors: BridgeSensors,
});
export type BridgeState = t.TypeOf<typeof BridgeState>;

// export type BridgeRequest<A> = (decoder: t.Decoder<unknown, A>, url: string, method?: Method, data?: unknown) => Promise<A>

export interface SensorEvent {
  id: ButtonType;
  value: unknown;
}

export type ButtonType = 'on' | 'dimUp' | 'dimDown' | 'off';
