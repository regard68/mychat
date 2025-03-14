const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*" }
});

app.use(express.json());
app.use(cors());

// ✅ 设置静态文件目录
const publicPath = path.join(__dirname, "public");
console.log("✅ 静态文件目录:", publicPath);
app.use(express.static(publicPath));

// ✅ 访问 `http://localhost:3000/` 时默认加载 `login.html`
app.get("/", (req, res) => {
    console.log("✅ 访问 /，返回 login.html");
    res.sendFile(path.join(publicPath, "login.html"));
});

// ✅ 确保 `chat.html` 可以正确访问
app.get("/chat", (req, res) => {
    console.log("✅ 访问 /chat，返回 chat.html");
    res.sendFile(path.join(publicPath, "chat.html"));
});

// ✅ 存储用户数据（用户名 -> 密码）
const users = {};

// ✅ 处理用户注册
app.post("/register", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: "用户名或密码不能为空" });
    }
    if (users[username]) {
        return res.status(400).json({ message: "用户名已存在" });
    }
    users[username] = password;
    console.log(`✅ 用户注册成功: ${username}`);
    res.json({ message: "注册成功！" });
});

// ✅ 处理用户登录
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (users[username] && users[username] === password) {
        console.log(`✅ 用户 ${username} 登录成功`);
        return res.json({ message: "登录成功！", username });
    }
    res.status(401).json({ message: "用户名或密码错误" });
});

// ✅ 监听所有请求路径，方便调试
app.use((req, res, next) => {
    console.log("🔍 收到请求:", req.method, req.url);
    next();
});

let onlineUsers = {}; // 存储在线用户
let messages = []; // 存储聊天记录

// 监听 WebSocket 连接
io.on("connection", (socket) => {
    console.log("✅ 新用户连接:", socket.id);

    // 用户加入聊天
    socket.on("join", (username) => {
        onlineUsers[socket.id] = username;
        io.emit("update-user-list", Object.values(onlineUsers));
        socket.emit("load-messages", messages); // 发送历史消息
        console.log(`🔵 用户 ${username} 加入聊天`);
    });

    // 发送消息
    socket.on("send-message", ({ content }) => {
        let sender = onlineUsers[socket.id] || "匿名用户";
        let msg = {
            sender,
            content,
            timestamp: new Date().toLocaleString()
        };

        messages.push(msg);
        if (messages.length > 50) messages.shift(); // 只保留 50 条消息

        io.emit("receive-message", msg);
        console.log(`📩 消息发送: ${sender}: ${content}`);
    });

    // 监听断开连接
    socket.on("disconnect", () => {
        console.log(`🔴 用户 ${onlineUsers[socket.id]} 断开连接`);
        delete onlineUsers[socket.id];
        io.emit("update-user-list", Object.values(onlineUsers));
    });
});

// 启动服务器
server.listen(3000, () => {
    console.log("✅ 服务器运行在 http://localhost:3000");
});
