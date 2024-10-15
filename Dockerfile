# syntax=docker/dockerfile:1.9

FROM docker.io/node:22-alpine as BUILD
ENV \
  PHANPY_CLIENT_NAME="Phanpy" \
  PHANPY_WEBSITE="https://phanpy.social" \
  PHANPY_DEFAULT_INSTANCE="mastodon.social" \
  PHANPY_DEFAULT_INSTANCE_REGISTRATION_URL="https://mastodon.social/auth/sign_up" \
  PHANPY_PRIVACY_POLICY_URL="https://mastodon.social/about" \
  PHANPY_DEFAULT_LANG="en" \
  PHANPY_LINGVA_INSTANCES="lingva.phanpy.social" \
  PHANPY_IMG_ALT_API_URL="" \
  PHANPY_GIPHY_API_KEY=""
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm install
COPY ./ ./
RUN npm run build

FROM docker.io/bitnami/nginx:1.27
COPY --from=BUILD /build/dist/ /app
