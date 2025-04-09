const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const mysql = require("mysql2");

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

// ⬆️ 数据库连接配置
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'loginusers'
});

db.connect(err => {
    if (err) {
        console.error("❌ 数据库连接失败:", err);
        return;
    }
    console.log("✅ 成功连接 MySQL 数据库！");
});

// ⬆️ 访问 `/` 时默认返回 login.html
app.get("/", (req, res) => res.sendFile(path.join(publicPath, "login.html")));

// ⬆️ 访问 `/chat` 返回 chat.html
app.get("/chat", (req, res) => res.sendFile(path.join(publicPath, "chat.html")));

// ⬆️ 用户注册
app.post("/register", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "用户名或密码不能为空" });

    const sql = "INSERT INTO users (username, password) VALUES (?, ?)";
    db.query(sql, [username, password], (err) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ message: "用户名已存在" });
            }
            return res.status(500).json({ message: "数据库错误" });
        }
        console.log(`✅ 用户注册成功: ${username}`);
        res.json({ message: "注册成功！" });
    });
});

// ⬆️ 用户登录
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const sql = "SELECT * FROM users WHERE username = ? AND password = ?";
    db.query(sql, [username, password], (err, results) => {
        if (err) return res.status(500).json({ message: "服务器错误" });
        if (results.length === 0) return res.status(401).json({ message: "用户名或密码错误" });

        console.log(`✅ 用户 ${username} 登录成功`);
        res.json({ message: "登录成功！", username });
    });
});

// ⬆️ 调试时输出请求
app.use((req, res, next) => {
    console.log("🔍 收到请求:", req.method, req.url);
    next();
});

let onlineUsers = {}; // 存储在线用户

// ⬆️ WebSocket 连接
io.on("connection", (socket) => {
    console.log("✅ 新用户连接:", socket.id);

    socket.on("join", (username) => {
        onlineUsers[socket.id] = username;
        io.emit("update-user-list", Object.values(onlineUsers));

        // 获取历史消息
        const sql = "SELECT * FROM messages ORDER BY id DESC LIMIT 50";
        db.query(sql, (err, results) => {
            if (!err) {
                socket.emit("load-messages", results.reverse());
            }
        });

        console.log(`🔵 用户 ${username} 加入聊天`);
    });

    socket.on("send-message", ({ content }) => {
        let sender = onlineUsers[socket.id] || "匿名用户";
        let timestamp = new Date().toLocaleString();

        const msg = { sender, content, timestamp };
        const sql = "INSERT INTO messages (sender, content, timestamp) VALUES (?, ?, ?)";
        db.query(sql, [sender, content, timestamp], (err) => {
            if (err) console.error("❌ 消息写入失败:", err);
        });

        io.emit("receive-message", msg);
        console.log(`📩 消息发送: ${sender}: ${content}`);
    });

    socket.on("disconnect", () => {
        console.log(`🔴 用户 ${onlineUsers[socket.id]} 断开连接`);
        delete onlineUsers[socket.id];
        io.emit("update-user-list", Object.values(onlineUsers));
    });
});

// ⬆️ 启动服务
server.listen(PORT, () => {
    console.log(`✅ 服务器运行在端口 ${PORT}`);
});
