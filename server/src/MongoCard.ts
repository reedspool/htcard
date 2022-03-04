import Koa, { ParameterizedContext } from 'koa';
import { Collection } from 'mongodb';
import { JSDOM } from 'jsdom';
import { KoaViewsRenderEJS } from './main';

export interface Card {
    slug: string;
    content: string;
}

export class MongoCard {
    collection: Collection<Card>;
    render: KoaViewsRenderEJS

    constructor(collection: Collection<Card>, render: KoaViewsRenderEJS) {
        this.collection = collection;
        // TODO Now use render in getBySlug
        this.render = render;
    }

    getAll() { return this.collection.find().toArray() };
    // TODO use graph lookup to search for all cards referenced via childCardSlugs
    getBySlug(slug: Card["slug"]) { return this.collection.findOne({ slug }) };

    create(card: Card) { return this.collection.insertOne(card) };

    update(slug: Card["slug"], card: Card) {
        const dom = new JSDOM(card.content);

        // Get all cards anywhere in the tree
        const descendantCards = Array.from(dom.window.document.querySelectorAll('[data-card]'));

        // Filter all descendant cards down to children, those at the top-level. Those do not have any
        // ancestor card. Additionally, a descendant with no parent is a child.
        const childCards = descendantCards.filter(node => (!node.parentElement) || !(node.parentElement.closest('[data-card]')))

        // Replace all direct child cards with an EJS template
        childCards.forEach(node => node.outerHTML = `<%- cards["${node.getAttribute('data-card')}"] %>`)

        // Setting outerHTML above with `<` and `>` causes escaping to html entities. Put them back in.
        const htmlWithChildCardsTemplated = dom.window.document.body.outerHTML.replace('&lt;', '<').replace('&gt;', '>');

        // Collect just the slugs
        const directChildCardSlugs = childCards.map(node => node.getAttribute('data-card'));

        return this.collection.updateOne({ slug }, {
            $set: {
                slug,
                content: htmlWithChildCardsTemplated,
                childCardSlugs: directChildCardSlugs
            }
        })
    }

    delete(slug: Card["slug"]) { return this.collection.deleteOne({ slug }); }

    static middleware(render: KoaViewsRenderEJS) {
        return (ctx: ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, unknown>, next: Koa.Next) => {
            ctx.Card = new MongoCard(ctx.db.collection<Card>('card'), render);
            return next();
        }
    }
}
