const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Supabase 配置
const supabaseUrl = "https://cvezrkgacfzowowdzarg.supabase.co";
const supabaseKey = "你的服务端密钥（不暴露前端）";
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" },
});

app.use(express.json());
app.use(cors());

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

app.get("/", (req, res) => res.sendFile(path.join(publicPath, "login.html")));
app.get("/chat", (req, res) => res.sendFile(path.join(publicPath, "chat.html")));

// ✅ 用户注册
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "用户名或密码不能为空" });

  // 检查用户名是否存在
  const { data: existing, error: queryError } = await supabase
    .from("users")
    .select("*")
    .eq("username", username);

  if (queryError) {
    console.error("❌ 查询失败：", queryError.message);
    return res.status(500).json({ message: "注册失败" });
  }

  if (existing.length > 0) {
    return res.status(400).json({ message: "用户名已存在" });
  }

  // 插入新用户
  const { error: insertError } = await supabase
    .from("users")
    .insert({ username, password });

  if (insertError) {
    console.error("❌ 插入失败：", insertError.message);
    return res.status(500).json({ message: "注册失败" });
  }

  console.log(`✅ 用户注册成功: ${username}`);
  res.json({ message: "注册成功" });
});

// ✅ 用户登录
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "用户名或密码不能为空" });

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password);

  if (error) {
    console.error("❌ 登录失败：", error.message);
    return res.status(500).json({ message: "登录失败" });
  }

  if (user.length === 0) {
    return res.status(401).json({ message: "用户名或密码错误" });
  }

  console.log(`✅ 用户 ${username} 登录成功`);
  res.json({ message: "登录成功", username });
});

// ✅ 聊天逻辑
let onlineUsers = {};

io.on("connection", (socket) => {
  console.log("🔌 用户连接:", socket.id);

  socket.on("join", async (username) => {
    onlineUsers[socket.id] = username;
    io.emit("update-user-list", Object.values(onlineUsers));

    // 加载历史消息
    const { data: history, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("❌ 加载消息失败：", error.message);
      socket.emit("load-messages", []);
    } else {
      const formatted = history.map((msg) => ({
        sender: msg.username,
        content: msg.content,
        timestamp: new Date(msg.created_at).toLocaleString(),
      }));
      socket.emit("load-messages", formatted);
    }

    console.log(`🔵 用户 ${username} 加入聊天`);
  });

  socket.on("send-message", async ({ content }) => {
    const username = onlineUsers[socket.id] || "匿名用户";

    const { error } = await supabase.from("messages").insert({
      username,
      content,
    });

    if (error) {
      console.error("❌ 消息存储失败：", error.message);
      return;
    }

    const msg = {
      sender: username,
      content,
      timestamp: new Date().toLocaleString(),
    };

    io.emit("receive-message", msg);
    console.log(`📩 ${username}: ${content}`);
  });

  socket.on("disconnect", () => {
    console.log(`🔴 用户 ${onlineUsers[socket.id]} 断开连接`);
    delete onlineUsers[socket.id];
    io.emit("update-user-list", Object.values(onlineUsers));
  });
});

// ✅ 启动服务器
server.listen(PORT, () => {
  console.log(`🚀 服务器运行中：http://localhost:${PORT}`);
});
