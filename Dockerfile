FROM node:10.16-alpine

WORKDIR /home/www/formula-data

COPY package.json *.lock .

RUN npm install

COPY . .

CMD [ "node", "./app.js" ]
