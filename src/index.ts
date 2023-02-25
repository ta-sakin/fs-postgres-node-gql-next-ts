import { __prod__ } from "./constants";
import { UserResolver } from "./resolvers/user";
import "reflect-metadata";
import { MikroORM } from "@mikro-orm/core";
import mikroOrmConfig from "./mikro-orm.config";
import express, { Request, Response } from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
const PORT = process.env.PORT || 4000;
import session from "express-session";
import { createClient } from "redis";
import { MyContext } from "./types";

const main = async () => {
  const orm = await MikroORM.init(mikroOrmConfig);
  await orm.getMigrator().up();
  const app = express();
  const RedisStore = require("connect-redis")(session);
  const redisClient = createClient({ legacyMode: true });
  await redisClient.connect();
  app.set("trust proxy", !__prod__);

  app.use(
    session({
      name: "qid",
      store: new RedisStore({ client: redisClient, disableTouch: true }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 15, //15 years,
        httpOnly: true,
        sameSite: __prod__ ? "lax" : "none",
        secure: true, //cookie only works in https
      },
      saveUninitialized: false,
      secret: "keyboard cat",
      resave: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),

    context: ({ req, res }): MyContext => ({
      em: orm.em,
      req,
      res,
    }),
  });
  await apolloServer.start();
  const corsSettings = {
    origin: ["https://studio.apollographql.com", "https://localhost:3000"],
    credentials: true,
  };
  apolloServer.applyMiddleware({ app, cors: corsSettings });
  app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
  });
};
main().catch((err) => {
  console.log(err);
});
