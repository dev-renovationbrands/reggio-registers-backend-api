FROM node:22-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# take the schema and generate types for it
RUN npx prisma generate
# make sure the server is built if you use a Prisma type
RUN npm run build
#  update the production database based on your schema
#RUN npx prisma migrate deploy
# Check if everything is working well. The database has been built, and the environment file is loaded.
#RUN npx prisma migrate status

#CMD ["npm", "run", "docker-start"]
CMD ["npm", "run", "start"]