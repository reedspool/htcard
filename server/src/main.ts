import Koa, { DefaultState, Context, ParameterizedContext } from 'koa';
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
import { MongoCard } from './MongoCard';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = new Koa({});

// Setup render function to return the result instead of
// writing to ctx.response.body. This allows rendering
// a template, and sending the result to another template
export type KoaViewsRenderEJS = (file: string, args: Record<string, any>) => Promise<string>;
let render: KoaViewsRenderEJS;
{
    const views = KoaViews(__dirname + '/../views', {
        extension: 'ejs',
        autoRender: false
    })

    // Koa views get angry with no `this` value
    //@ts-ignore expects 2 parameters, but doesn't actually need them
    render = views().bind({});
}

// Use views as hacky middleware to create ctx.renderPage function
// as well as normal ctx.render. ctx.renderPage allows us to
// easily use a common base page template and a separate body template
{
    const routerViews = KoaViews(__dirname + '/../views', {
        extension: 'ejs',
    })
    //@ts-ignore expects 2 parameters, but doesn't actually need them
    app.context.render = routerViews();

    app.context.renderPage = async function(template: string, data: Record<string, any>) {
        return this.render("base", { body: await render(template, data) })
    }
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

//
// Cards routes
//
{
    const cardRoutes = new Router<DefaultState, Context>();
    app.use(MongoCard.middleware())
    cardRoutes.get('/', async ctx => ctx.renderPage('index', { cards: await ctx.Card.getAll() }))
    cardRoutes.get('/cards', async ctx => ctx.body = await ctx.Card.getAll());
    cardRoutes.get('/card/:slug/edit', async ctx => ctx.renderPage('edit_card', await ctx.Card.getBySlug(ctx.params.slug)));
    cardRoutes.get('/card/:slug', async ctx => ctx.renderPage('card', await ctx.Card.getBySlug(ctx.params.slug)));
    cardRoutes.put('/card', async ctx => {
        await ctx.Card.create(ctx.request.body)
    })
    cardRoutes.post('/card/:slug', async ctx => {
        await ctx.Card.update(ctx.params.slug, ctx.request.body)
        return ctx.renderPage('card', await ctx.Card.getBySlug(ctx.params.slug))
    })
    cardRoutes.delete('/card/:slug', async ctx => ctx.Card.delete(ctx.params.slug))

    app.use(cardRoutes.routes())
    app.use(cardRoutes.allowedMethods())
}

// The default status is 404
app.use(async ctx => {
    if (ctx.status !== 404) return;
    await ctx.render("not_found")
    ctx.status = 404;
})

app.listen(80);
