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

// Enhanced response chunks with more natural conversation flow
const responseChunks = [
  {
    type: "text",
    data: "Hello! I'm analyzing your message...",
    style: { fontWeight: "bold" },
    isComplete: false,
  },
  {
    type: "text",
    data: "Based on your input, I've found some interesting insights...",
    style: { fontStyle: "italic" },
    isComplete: false,
  },
  {
    type: "text",
    data: "Let me show you a visual representation of what I found:",
    style: { color: "#4A5568" },
    isComplete: false,
  },
  {
    type: "image",
    data: "https://imageio.forbes.com/specials-images/imageserve/5d35eacaf1176b0008974b54/0x0.jpg?format=jpg&crop=4560,2565,x790,y784,safe&height=600&width=1200&fit=bounds",
    alt: "Analysis visualization",
    style: { width: "30%" },
    isComplete: false,
  },
  {
    type: "text",
    data: "Here's what we can learn from this:",
    style: { fontWeight: "500" },
    isComplete: false,
  },
  {
    type: "text",
    data: "1. The data shows some interesting patterns\n2. There are several key insights\n3. We can draw some valuable conclusions",
    style: { color: "#2D3748" },
    isComplete: false,
  },
  {
    type: "text",
    data: "Would you like to explore this topic further?",
    style: { color: "#4A5568" },
    isComplete: false,
  },
  {
    type: "button",
    data: "Learn More",
    action: { type: "navigate", target: "/learn" },
    style: { backgroundColor: "#4299E1", color: "#FFFFFF", padding: "8px 16px" },
    isComplete: true,
  },
];

const sendChunksWithTypingEffect = async (socket, chunks) => {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = {
      ...chunks[i],
      isComplete: i === chunks.length - 1,
    };

    // Add random delay between chunks to simulate natural typing
    const delay = chunk.type === "text" ? 
      Math.random() * 500 + 1000 : // 1-1.5s for text
      500; // 0.5s for other types

    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      socket.emit("messageChunk", chunk);
    } catch (error) {
      console.error("Error sending chunk:", error);
      break;
    }
  }
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

  socket.on("message", async (message) => {
    const name = users.get(socket.id);
    if (!name) return;

    console.log(`Message from ${name}:`, message);

    try {
      await sendChunksWithTypingEffect(socket, responseChunks);
    } catch (error) {
      console.error("Error in message handling:", error);
      socket.emit("systemMessage", {
        text: "An error occurred while processing your message",
        timestamp: new Date(),
      });
    }
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

// Error handling
io.on("error", (error) => {
  console.error("Socket.IO error:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});

server.listen(5000, () => {
  console.log("Server is running on port 5000");
});