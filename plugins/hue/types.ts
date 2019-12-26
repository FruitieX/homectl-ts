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
export const BridgeScenesSummary = t.record(t.string, BridgeSceneSummary);

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

export const BridgeState = t.type({
  lights: BridgeLights,
  scenes: BridgeScenesSummary,
  sensors: BridgeSensors
})