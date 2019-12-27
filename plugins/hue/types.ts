import * as t from 'io-ts'

export const BridgeLight = t.type({
  state: t.type({
    on: t.boolean,
    bri: t.union([t.number, t.undefined]),
    hue: t.union([t.number, t.undefined]),
    sat: t.union([t.number, t.undefined])
  }),
  name: t.string
})
export const BridgeLights = t.record(t.string, BridgeLight);

export const BridgeSceneSummary = t.type({
  name: t.string
})
export type BridgeSceneSummary = t.TypeOf<typeof BridgeSceneSummary>
export const BridgeScenesSummary = t.record(t.string, BridgeSceneSummary);

export const BridgeSceneCreatedResponse = t.tuple([t.type({ success: t.type({ id: t.string }) })])

// maybe we can do without the rules?
// export const BridgeRuleCondition = t.type({
//   address: t.string,
//   operator: t.string,
//   value: t.string
// })
// export const BridgeRuleAction = t.type({
//   address: t.string,
//   method: t.string,
//   body: t.unknown
// })
// export const BridgeRule = t.type({
//   name: t.string,
//   conditions: t.array(BridgeRuleCondition),
//   actions: t.array(BridgeRuleAction),
// })
// export const BridgeRules = t.record(t.string, BridgeRule);

export const BridgeSensor = t.type({
  state: t.type({
    buttonevent: t.union([t.number, t.undefined]),
    lastupdated: t.string,
  }),
  name: t.string,
  type: t.string,

})

export const BridgeSensors = t.record(t.string, BridgeSensor)
export type BridgeSensors = t.TypeOf<typeof BridgeSensors>

export const BridgeState = t.type({
  lights: BridgeLights,
  scenes: BridgeScenesSummary,
  sensors: BridgeSensors
})
export type BridgeState = t.TypeOf<typeof BridgeState>

// export type BridgeRequest<A> = (decoder: t.Decoder<unknown, A>, url: string, method?: Method, data?: unknown) => Promise<A>

export interface SensorEvent {
  id: ButtonType;
  value: unknown;
}

export type ButtonType = "on" | "dimUp" | "dimDown" | "off"