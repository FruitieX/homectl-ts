import Koa from 'koa'
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import * as t from 'io-ts'

import { PluginProps } from "../types";
import { HomectlPlugin } from '../plugins';

const Config = t.type({
  port: t.number,
  prefix: t.string,
})
type Config = t.TypeOf<typeof Config>

const getDevices: Router.IMiddleware = (ctx, next) => {
  ctx.body = "hello world";
};

/**
 * REST API plugin
 * 
 * Implements a simple REST API for examining and manipulating device states
 */

export default class RestPlugin extends HomectlPlugin<Config> {
  constructor(props: PluginProps<Config>) {
    super(props, Config);
  }

  async register() {
    const app = new Koa();
    const router = new Router({ prefix: '/api/v1' });

    app.use(bodyParser());
    app.use(router.routes()).use(router.allowedMethods());

    router.get('devices', '/devices', getDevices);
    router.post('msg', '/msg', ctx => {
      this.sendMsg(ctx.request.body.path, t.unknown, ctx.request.body.payload)
    });

    const port = this.config.port || 1234;
    app.listen(port);
    this.log(`REST API bound to port ${port}`);
  }
}
