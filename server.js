const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000; // 监听 Render 分配的端口
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

// ✅ 访问 `/` 时默认加载 `login.html`
app.get("/", (req, res) => res.sendFile(path.join(publicPath, "login.html")));

// ✅ 访问 `/chat` 时返回 `chat.html`
app.get("/chat", (req, res) => res.sendFile(path.join(publicPath, "chat.html")));

// ✅ 存储用户数据（用户名 -> 密码）
const users = {};

// ✅ 处理用户注册
app.post("/register", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "用户名或密码不能为空" });
    if (users[username]) return res.status(400).json({ message: "用户名已存在" });

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

// ✅ 读取历史消息（防止服务器重启后丢失）
const messagesFile = path.join(__dirname, "messages.json");

// 读取文件中的历史消息
function loadMessages() {
    if (fs.existsSync(messagesFile)) {
        const data = fs.readFileSync(messagesFile, "utf-8");
        return JSON.parse(data);
    }
    return [];
}

// 存储聊天记录到 JSON 文件
function saveMessages() {
    fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2), "utf-8");
}

let onlineUsers = {}; // 存储在线用户
let messages = loadMessages(); // 读取历史消息

// ✅ WebSocket 连接
io.on("connection", (socket) => {
    console.log("✅ 新用户连接:", socket.id);

    // 用户加入聊天
    socket.on("join", (username) => {
        onlineUsers[socket.id] = username;
        io.emit("update-user-list", Object.values(onlineUsers));

        // ✅ 发送历史消息给新用户
        socket.emit("load-messages", messages);
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
        saveMessages(); // ✅ 存储到文件，防止丢失

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

// ✅ 监听 PORT 并启动服务器
server.listen(PORT, () => {
    console.log(`✅ 服务器运行在端口 ${PORT}`);
});
