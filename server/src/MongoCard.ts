import Koa, { ParameterizedContext } from 'koa';
import { Collection } from 'mongodb';

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
    getBySlug(slug: Card["slug"]) { return this.collection.findOne({ slug }) };
    create(card: Card) { return this.collection.insertOne(card) };
    update(slug: Card["slug"], card: Card) { return this.collection.updateOne({ slug }, { $set: card }) }
    delete(slug: Card["slug"]) { return this.collection.deleteOne({ slug }); }

    static middleware() {
        return (ctx: ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, unknown>, next: Koa.Next) => {
            ctx.Card = new MongoCard(ctx.db.collection<Card>('card'));
            return next();
        }
    }
}
