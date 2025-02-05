from node:21-alpine as builder

workdir /code

copy . /code

run npm ci && npm run build

from nginx:1.25.4-alpine

label maintainer="Victoria Nadasdi <efertone@pm.me>"
label org.opencontainers.image.source=https://github.com/cheeaun/phanpy
label org.opencontainers.image.description="Docker Image for Phanpy"
label org.opencontainers.image.licenses=MIT

copy --from=builder /code/dist /usr/share/nginx/html
