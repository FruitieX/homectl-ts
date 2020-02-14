import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import * as t from 'io-ts';

import { PluginProps } from '../../types';
import { HomectlPlugin } from '../../plugins';

const Config = t.type({
  plugin: t.literal('api'),
  port: t.number,
});
type Config = t.TypeOf<typeof Config>;

/**
 * Api plugin
 *
 * Provides a very simple rest API for controlling purposes
 */

export default class ApiPlugin extends HomectlPlugin<Config> {
  constructor(props: PluginProps<Config>) {
    super(props, Config);

    const app = new Koa();

    app.use(bodyParser({ strict: false }));

    app.use(async ctx => {
      ctx.body = await this.sendMsg(
        ctx.request.url.slice(1), // get rid of leading slash
        t.unknown,
        ctx.request.body,
      );
    });

    app.listen(this.config.port);
  }
}
