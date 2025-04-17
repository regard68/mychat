const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*" }
});

app.use(express.json());
app.use(cors());

// ⬆️ 设置静态文件目录
const publicPath = path.join(__dirname, "public");
console.log("✅ 静态文件目录:", publicPath);
app.use(express.static(publicPath));

// ⬆️ 存储用户数据（用户名 -> 密码）
const users = {}; // 内存中保存注册的用户
const messages = []; // 内存中保存聊天记录
let onlineUsers = {}; // 在线用户

// ⬆️ 访问 `/` 返回 login.html
app.get("/", (req, res) => res.sendFile(path.join(publicPath, "login.html")));

// ⬆️ 访问 `/chat` 返回 chat.html
app.get("/chat", (req, res) => res.sendFile(path.join(publicPath, "chat.html")));

// ⬆️ 用户注册接口
app.post("/register", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "用户名或密码不能为空" });
    if (users[username]) return res.status(400).json({ message: "用户名已存在" });

    users[username] = password;
    console.log(`✅ 用户注册成功: ${username}`);
    res.json({ message: "注册成功！" });
});

// ⬆️ 用户登录接口
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (users[username] && users[username] === password) {
        console.log(`✅ 用户 ${username} 登录成功`);
        return res.json({ message: "登录成功！", username });
    }
    res.status(401).json({ message: "用户名或密码错误" });
});

// ⬆️ 所有请求调试日志
app.use((req, res, next) => {
    console.log("🔍 收到请求:", req.method, req.url);
    next();
});

// ⬆️ WebSocket 连接
io.on("connection", (socket) => {
    console.log("✅ 新用户连接:", socket.id);

    socket.on("join", (username) => {
        onlineUsers[socket.id] = username;
        io.emit("update-user-list", Object.values(onlineUsers));

        // 发送历史聊天记录给新用户
        socket.emit("load-messages", messages);
        console.log(`🔵 用户 ${username} 加入聊天`);
    });

    socket.on("send-message", ({ content }) => {
        let sender = onlineUsers[socket.id] || "匿名用户";
        let timestamp = new Date().toLocaleString();

        const msg = { sender, content, timestamp };
        messages.push(msg);
        if (messages.length > 50) messages.shift(); // 最多保留50条聊天记录

        io.emit("receive-message", msg);
        console.log(`📩 消息发送: ${sender}: ${content}`);
    });

    socket.on("disconnect", () => {
        console.log(`🔴 用户 ${onlineUsers[socket.id]} 断开连接`);
        delete onlineUsers[socket.id];
        io.emit("update-user-list", Object.values(onlineUsers));
    });
});

// ⬆️ 启动服务器
server.listen(PORT, () => {
    console.log(`✅ 服务器运行在端口 ${PORT}`);
});
