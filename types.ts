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
export const Routine = t.type({
  when: t.array(Condition),
  do: t.array(t.string)
})

export const Group = t.type({
  name: t.string,
  devices: t.array(t.string)
})

export const SceneCommand = t.type({
  path: t.string,
  power: t.boolean,
})
export const Scene = t.type({
  name: t.string,
  devices: t.array(SceneCommand)
})

export const AppConfig = t.type({
  integrations: IntegrationsConfig,
  routines: t.record(t.string, Routine),
  groups: t.record(t.string, Group),
  scenes: t.record(t.string, Scene),
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

export type SendMsg = (path: string, payload: unknown) => void
export interface PluginProps<A> {
  config: A,
  app: Koa,
  appConfig: AppConfig,
  sendMsg: SendMsg
}