FROM public.ecr.aws/docker/library/node:lts-bookworm-slim

ARG VKM_URL
ENV ENV_VKM_URL=$VKM_URL

ARG APP_PATH
ENV ENV_APP_PATH=$APP_PATH

WORKDIR /vkm-ui
COPY . .
RUN echo "deb http://security.debian.org/debian-security bookworm-security main contrib non-free" >> /etc/apt/sources.list && \
	apt-get -y update && \
	apt-get -y upgrade && \
	apt-get -y install python3-pip && \
	pip3 install --break-system-packages --upgrade pip && \ 
	pip3 install --break-system-packages -r requirements.txt && \
    yarn

RUN echo "var appPath = \"${ENV_APP_PATH}\";" > public/js/defs.js

EXPOSE 80
CMD ["node", "server.js"]