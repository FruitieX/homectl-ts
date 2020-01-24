import Koa from 'koa'
import * as t from 'io-ts'
import { pipe } from 'fp-ts/lib/pipeable';
import { fold, left } from 'fp-ts/lib/Either';
import { identity } from 'fp-ts/lib/function';
import { reporter } from 'io-ts-reporters'

export const IntegrationConfig = t.type({
  plugin: t.string
})
export type IntegrationConfig = t.TypeOf<typeof IntegrationConfig>
export const IntegrationsConfig = t.record(t.string, IntegrationConfig);
export type IntegrationsConfig = t.TypeOf<typeof IntegrationsConfig>

export const Condition = t.type({
  path: t.string,
  is: t.boolean
})
export const RoutineConfig = t.type({
  when: t.array(Condition),
  do: t.array(t.string)
})
export type RoutineConfig = t.TypeOf<typeof RoutineConfig>
export const RoutinesConfig = t.record(t.string, RoutineConfig);
export type RoutinesConfig = t.TypeOf<typeof RoutinesConfig>

export const GroupConfig = t.type({
  name: t.string,
  devices: t.array(t.string)
})
export const GroupsConfig = t.record(t.string, GroupConfig);
export type GroupsConfig = t.TypeOf<typeof GroupsConfig>

export const DeviceState = t.type({
  power: t.boolean,
  color: t.union([t.string, t.undefined])
})
export type DeviceState = t.TypeOf<typeof DeviceState>

export const DeviceCommand = t.type({
  path: t.string,
  power: t.boolean,
  color: t.union([t.string, t.undefined]),
  transition: t.union([t.number, t.undefined]),
  brightness: t.union([t.number, t.undefined])
})
export type DeviceCommand = t.TypeOf<typeof DeviceCommand>
export const DeviceCommands = t.array(DeviceCommand)
export type DeviceCommands = t.TypeOf<typeof DeviceCommands>
export const SceneConfig = t.type({
  name: t.string,
  devices: t.array(DeviceCommand)
})
export const ScenesConfig = t.record(t.string, SceneConfig);
export type ScenesConfig = t.TypeOf<typeof ScenesConfig>

// export const DevicesConfig = t.type({})

export const AppConfig = t.type({
  integrations: IntegrationsConfig,
  routines: RoutinesConfig,
  groups: GroupsConfig,
  scenes: ScenesConfig,
  // devices: DevicesConfig,
})
export type AppConfig = t.TypeOf<typeof AppConfig>

export const throwDecoder = <A>(decoder: t.Decoder<unknown, A>) => (value: unknown, msg: string): A =>
  pipe(
    decoder.decode(value),
    fold(e => {
      console.error(msg)
      throw new Error(JSON.stringify(reporter(left(e))))
    }, identity)
  )

export type SendMsg = <A>(path: string, decoder: t.Decoder<unknown, A>, payload?: unknown) => Promise<A>
export interface PluginProps<A> {
  id: string,
  config: A,
  app: Koa,
  appConfig: AppConfig,
  sendMsg: SendMsg
}

export const SensorUpdate = t.type({
  path: t.string,
  value: t.unknown,
})
export type SensorUpdate = t.TypeOf<typeof SensorUpdate>
