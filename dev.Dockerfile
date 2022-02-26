FROM node:16

WORKDIR /web

# In Dev, all files under server/ are shared via a volume
# so that we can change them without requiring a docker restart

RUN chown -Rh node:node /web

COPY package*.json ./
RUN npm install

# Use nodemon to restart the server process on every file change
COPY nodemon.json tsconfig.json tsconfig.rollup.json rollup.config.js postcss.config.cjs tailwind.config.cjs ./

RUN mkdir /web/typescriptBuild
RUN chown -Rh node:node --from root:root /web

# Nodemon reads from package.json's main for entrypoint
CMD [ "npx", "concurrently", "\"npm:dev:server\"", "\"npm:dev:browser\""]
