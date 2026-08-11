FROM node:22-alpine
WORKDIR /app

# Copy package.json và cài đặt thư viện
COPY package*.json ./
RUN npm install

# Copy toàn bộ mã nguồn
COPY . .

EXPOSE 5173
# Thêm cờ --host để Vite cho phép truy cập từ bên ngoài mạng của container
CMD ["npm", "run", "dev", "--", "--host"]