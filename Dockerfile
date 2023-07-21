# start from an Ubuntu 20.04 images (node:18 images doesn't work. something missing ?)
FROM ubuntu:20.04

# install node 18
RUN apt update
RUN apt -y upgrade
RUN apt update
RUN apt -y install curl dirmngr apt-transport-https lsb-release ca-certificates
RUN curl -sL https://deb.nodesource.com/setup_18.x | bash -
RUN apt -y install nodejs
RUN apt -y install gcc g++ make

# from here improved-initiative installation
ARG NODE_ENV
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin
RUN npm install -g grunt

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

COPY . .
RUN npx grunt

ENV NODE_ENV=${NODE_ENV}
RUN if [ "$NODE_ENV" = "production" ]; then grunt --no-color build_min; else grunt --no-color build_dev; fi

EXPOSE 80
CMD [ "node", "server/server.js" ]
