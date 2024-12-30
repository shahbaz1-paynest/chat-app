const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true,
  },
});

const users = new Map();

const responseChunks = [
  {
    type: "text",
    data: "Hello! I'm processing your message...",
    style: { fontWeight: "bold" },
    isComplete: false,
  },
  {
    type: "text",
    data: "Analyzing your request...",
    style: { fontStyle: "italic" },
    isComplete: false,
  },
  {
    type: "image",
    data: "/api/placeholder/300/200",
    alt: "Analysis image",
    style: { width: "100%" },
    isComplete: false,
  },
  {
    type: "text",
    data: "Would you like to learn more about this?",
    style: { color: "#4A5568" },
    isComplete: false,
  },
  {
    type: "button",
    data: "Learn More",
    action: { type: "navigate", target: "/learn" },
    style: { backgroundColor: "#4299E1", color: "#FFFFFF" },
    isComplete: true,
  },
];

const sendChunks = (socket, chunks, delay = 1000) => {
  chunks.forEach((chunk, index) => {
    setTimeout(() => socket.emit("messageChunk", chunk), index * delay);
  });
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("setName", (name) => {
    users.set(socket.id, name);
    console.log(`${name} connected (Socket ID: ${socket.id})`);

    io.emit("systemMessage", {
      text: `${name} has joined the chat`,
      timestamp: new Date(),
    });
  });

  socket.on("message", (message) => {
    const name = users.get(socket.id);
    if (!name) return;

    console.log(`Message from ${name}:`, message);

    sendChunks(socket, responseChunks);
  });

  socket.on("disconnect", () => {
    const name = users.get(socket.id);
    if (name) {
      io.emit("systemMessage", {
        text: `${name} has left the chat`,
        timestamp: new Date(),
      });
      console.log(`${name} disconnected (Socket ID: ${socket.id})`);
      users.delete(socket.id);
    }
  });
});

server.listen(5000, () => {
  console.log("Server is running on port 5000");
});
