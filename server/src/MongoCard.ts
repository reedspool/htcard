import Koa, { ParameterizedContext } from 'koa';
import { Collection } from 'mongodb';
import { JSDOM } from 'jsdom';
import ejs from 'ejs';

export interface Card {
    slug: string;
    content: string;
}

export class MongoCard {
    collection: Collection<Card>;

    constructor(collection: Collection<Card>) {
        this.collection = collection;
    }

    getAll() { return this.collection.find().toArray() };

    // TODO use graph lookup to search for all cards referenced via childCardSlugs
    /**
     * Construct card's content by fetching all its children
     */
    async getBySlug(slug: Card["slug"]) {
        const allDescendantCards = await this.collection.aggregate([
            { $match: { slug } },
            {
                $graphLookup: {
                    from: 'card',
                    startWith: '$childCardSlugs',
                    connectFromField: 'childCardSlugs',
                    connectToField: 'slug',
                    as: 'childCards',
                    maxDepth: 100,
                    depthField: '__depth',
                }
            }
        ]).toArray();

        const rootCard = allDescendantCards[0];

        // Sort the descendant cards in reverse depth order, because in this order
        // we can render each in a loop
        const reverseDepthDescendantCards = rootCard.childCards.sort((a, b) => b.__depth - a.__depth)

        // Transpose child card array into a map from slug to content
        const childCardContentBySlug = {};

        reverseDepthDescendantCards.forEach(({ slug, content }) => {
            // Render this content. Because we're going in reverse depth order,
            // we can be sure that any child card has already been rendered into the map
            // Content might not be set, in which case no render is necessary
            if (content) content = ejs.render(content, { cards: childCardContentBySlug });

            // Wrap the content with the card wrapper
            childCardContentBySlug[slug] = `<div data-card="${slug}">${content || ''}</div>`;
        })

        // Finally, render the root card
        if (rootCard.content) rootCard.content = ejs.render(rootCard.content, { cards: childCardContentBySlug });

        return rootCard;
    };

    create(card: Card) { return this.collection.insertOne(card) };

    /**
     * Update a card, replacing its children with templates and separate references to their slugs
     */
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

    static middleware() {
        return (ctx: ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, unknown>, next: Koa.Next) => {
            ctx.Card = new MongoCard(ctx.db.collection<Card>('card'));
            return next();
        }
    }
}
