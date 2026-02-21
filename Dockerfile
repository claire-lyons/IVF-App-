FROM node:22
WORKDIR /app
RUN echo "Copying files...."
COPY . .
WORKDIR /app
RUN npm install
RUN npm run build
CMD ["npm", "run", "start"]
EXPOSE 5001