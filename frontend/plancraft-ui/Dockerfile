FROM node:20-alpine AS build
WORKDIR /ui
COPY . .
RUN npm ci || npm install
RUN npm run build

FROM node:20-alpine
WORKDIR /ui
COPY --from=build /ui/dist dist
RUN npm i -g serve
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
