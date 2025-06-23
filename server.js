const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const { createClient } = require('@supabase/supabase-js'); // 引入 supabase

// ⚠️ 替换为你自己的 Supabase 项目信息
const supabaseUrl = 'https://cvezrkgacfzowowdzarg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZXpya2dhY2Z6b3dvd2R6YXJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDY2Mjc3OCwiZXhwIjoyMDY2MjM4Nzc4fQ.mwS46U4a418fGjCfpbl1dyUAkb7GoRwiiHH5OW68OJQ'; // 注意：只能后端用，千万别放前端！
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*" }
});

app.use(express.json());
app.use(cors());

const publicPath = path.join(__dirname, "public");
console.log("✅ 静态文件目录:", publicPath);
app.use(express.static(publicPath));

// 模拟用户注册（只用于本地测试，不存数据库）
const users = {}; 
let onlineUsers = {}; 

app.get("/", (req, res) => res.sendFile(path.join(publicPath, "login.html")));
app.get("/chat", (req, res) => res.sendFile(path.join(publicPath, "chat.html")));

// 用户注册
app.post("/register", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "用户名或密码不能为空" });
    if (users[username]) return res.status(400).json({ message: "用户名已存在" });

    users[username] = {
        password,
        registerTime: Date.now()
    };
    console.log(`✅ 用户注册成功: ${username}`);
    res.json({ message: "注册成功！" });
});

// 用户登录
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (users[username] && users[username].password === password) {
        console.log(`✅ 用户 ${username} 登录成功`);
        return res.json({ message: "登录成功！", username });
    }
    res.status(401).json({ message: "用户名或密码错误" });
});

// WebSocket 聊天逻辑
io.on("connection", (socket) => {
    console.log("✅ 新用户连接:", socket.id);

    socket.on("join", async (username) => {
        onlineUsers[socket.id] = username;
        io.emit("update-user-list", Object.values(onlineUsers));

        // 👉 加载历史消息（从 Supabase 数据库）
        const { data: history, error } = await supabase
            .from("messages")
            .select("*")
            .order("created_at", { ascending: true });

        if (error) {
            console.error("❌ 加载消息失败:", error.message);
            socket.emit("load-messages", []);
        } else {
            const formatted = history.map(msg => ({
                sender: msg.username,
                content: msg.content,
                timestamp: new Date(msg.created_at).toLocaleString()
            }));
            socket.emit("load-messages", formatted);
        }

        console.log(`🔵 用户 ${username} 加入聊天`);
    });

    socket.on("send-message", async ({ content }) => {
        const username = onlineUsers[socket.id] || "匿名用户";

        // 👉 保存消息到 Supabase 数据库
        const { error } = await supabase.from('messages').insert({
            username,
            content
        });

        if (error) {
            console.error("❌ 消息存储失败：", error.message);
            return;
        }

        const msg = {
            sender: username,
            content,
            timestamp: new Date().toLocaleString()
        };

        io.emit("receive-message", msg);
        console.log(`📩 ${username}：${content}`);
    });

    socket.on("disconnect", () => {
        console.log(`🔴 用户 ${onlineUsers[socket.id]} 断开连接`);
        delete onlineUsers[socket.id];
        io.emit("update-user-list", Object.values(onlineUsers));
    });
});

// 启动服务器
server.listen(PORT, () => {
    console.log(`✅ 服务器运行中：http://localhost:${PORT}`);
});
