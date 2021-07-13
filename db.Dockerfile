FROM --platform=linux/x86_64 postgres:12
RUN apt-get update
RUN apt-get install -y curl
RUN locale-gen ja_JP.UTF-8
RUN localedef -f UTF-8 -i ja_JP ja_JP
USER postgres
ENV LANG ja_JP.UTF-8
ENV TZ Asia/Tokyo