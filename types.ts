import Koa from 'koa'
import * as t from 'io-ts'
import { pipe } from 'fp-ts/lib/pipeable';
import { fold, Either } from 'fp-ts/lib/Either';
import { PathReporter } from 'io-ts/lib/PathReporter';
import { identity } from 'fp-ts/lib/function';

export const IntegrationConfig = t.type({
  plugin: t.string
})
export type IntegrationConfig = t.TypeOf<typeof IntegrationConfig>
export const IntegrationsConfig = t.record(t.string, IntegrationConfig);
export type IntegrationsConfig = t.TypeOf<typeof IntegrationsConfig>

export const Condition = t.type({
  value: t.string,
  is: t.boolean
})
export const RoutineConfig = t.type({
  when: t.array(Condition),
  do: t.array(t.string)
})
export const RoutinesConfig = t.record(t.string, RoutineConfig);
export type RoutinesConfig = t.TypeOf<typeof RoutinesConfig>

export const GroupConfig = t.type({
  name: t.string,
  devices: t.array(t.string)
})
export const GroupsConfig = t.record(t.string, GroupConfig);
export type GroupsConfig = t.TypeOf<typeof GroupsConfig>

export const SceneCommand = t.type({
  path: t.string,
  power: t.boolean,
  color: t.union([t.string, t.undefined]),
  brightness: t.union([t.number, t.undefined])
})
export type SceneCommand = t.TypeOf<typeof SceneCommand>
export const SceneConfig = t.type({
  name: t.string,
  devices: t.array(SceneCommand)
})
export const ScenesConfig = t.record(t.string, SceneConfig);
export type ScenesConfig = t.TypeOf<typeof ScenesConfig>

export const AppConfig = t.type({
  integrations: IntegrationsConfig,
  routines: RoutinesConfig,
  groups: GroupsConfig,
  scenes: ScenesConfig,
})
export type AppConfig = t.TypeOf<typeof AppConfig>

export const throwDecoder = <A>(decoded: Either<t.Errors, A>, msg: string): A =>
  pipe(
    decoded,
    fold(() => {
      console.error(msg)
      console.log(JSON.stringify(PathReporter.report(decoded)))
      process.exit(1)
    }, identity)
  )

export type SendMsg = (path: string, payload?: unknown) => void
export interface PluginProps<A> {
  config: A,
  app: Koa,
  appConfig: AppConfig,
  sendMsg: SendMsg
}