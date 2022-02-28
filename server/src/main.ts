import EventEmitter from 'events';
import Koa, { DefaultState, Context } from 'koa';
import Router from 'koa-router';
import logger from 'koa-logger';
import KoaViews from 'koa-views';
import KoaStatic from 'koa-static';
import KoaMount from 'koa-mount';
import KoaBodyParser from 'koa-bodyparser';
import KoaMongo from 'koa-mongo';

// From https://stackoverflow.com/a/64383997
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eventEmitter = new EventEmitter();

interface CustomContext {
    // This doesn't seem to work :-/ no idea why
    renderPage: any;

    // This doesn't seem to work :-/ no idea why
    sse: {
        on: (name: string, listener: (...args: any[]) => void) => void,
        send: (message: string) => void,
        sendEnd: () => void
    }
}
const app = new Koa({});

const router = new Router<DefaultState, Context & CustomContext>();

const routerViews = KoaViews(__dirname + '/../views', {
    extension: 'ejs',
})
const views = KoaViews(__dirname + '/../views', {
    extension: 'ejs',
    autoRender: false
})

// Koa views get angry with no `this` value
//@ts-ignore expects 2 parameters, but doesn't actually need them
const render = views().bind({});
//@ts-ignore expects 2 parameters, but doesn't actually need them
app.context.render = routerViews();

app.context.renderPage = async function(template: string, data: Record<string, any>) {
    return this.render("base", { body: await render(template, data) })
}

app.use(logger())
app.use(KoaBodyParser({
    extendTypes: {
        // Content-Type request header should match this to be parsed
        json: ['application/x-javascript']
    }
}))
app.use(KoaMongo({
    uri: 'mongodb://user1:useruser@mongo:27017/htcard-mongo', //or url
}))
app.use(KoaMount('/static/', KoaStatic(__dirname + '/../www/build')))
app.use(KoaMount('/views/', KoaStatic(__dirname + '/../views')))

router.get('/', ctx => ctx.renderPage('index'))

app.use(router.routes())
app.use(router.allowedMethods())

// The default status is 404
app.use(async ctx => ctx.status === 404 && ctx.render("not_found"))

app.listen(80);
