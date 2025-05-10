FROM node:22.15.0-slim

RUN apt-get update && apt-get install -y \
  git \
  locales \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  && localedef -i ja_JP -c -f UTF-8 -A /usr/share/locale/locale.alias ja_JP.UTF-8

ENV LANG ja_JP.utf8
ENV TZ=Asia/Tokyo

WORKDIR /app
