#############################################
# Install everything to build the application
#############################################
FROM node:20-alpine AS build

WORKDIR /root/phanpy

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

##################################################
# Special stage to easily extract the app as a zip
##################################################
FROM alpine:3 AS artifacts

WORKDIR /root/phanpy

RUN apk add zip
COPY --from=build /root/phanpy/dist /root/phanpy/dist

# Outputs:
# - /root/phanpy/latest.zip
# - /root/phanpy/latest.tar.gz
RUN zip -r /root/phanpy/latest.zip dist && \
    tar -czf /root/phanpy/latest.tar.gz dist

#####################################################
# Copy the static files to a mininal web server image
#####################################################
FROM nginx:1-alpine-slim

ENV NGINX_ENTRYPOINT_QUIET_LOGS=1
COPY --chown=static:static --from=build /root/phanpy/dist /usr/share/nginx/html
