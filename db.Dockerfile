FROM postgres:16.1

RUN apt-get update && apt-get install -y \
  curl \
  && localedef -i ja_JP -c -f UTF-8 -A /usr/share/locale/locale.alias ja_JP.UTF-8

USER postgres
ENV LANG=ja_JP.UTF-8
ENV TZ=Asia/Tokyo