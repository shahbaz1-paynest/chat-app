import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import Typewriter from "typewriter-effect";

const socket = io("http://localhost:5000");

function Chat() {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [name, setName] = useState("");
  const [showNamePopup, setShowNamePopup] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    socket.on("connect", () => {
      setIsConnected(true);
      console.log("Connected to server");
    });

    socket.on("messageChunk", (chunk) => {
      console.log("Received chunk:", chunk);

      setMessages((prevMessages) => {
        const lastMessage = prevMessages[prevMessages.length - 1];

        if (lastMessage?.isAiResponse && !lastMessage.isComplete) {
          const updatedMessages = [...prevMessages];
          updatedMessages[updatedMessages.length - 1] = {
            ...lastMessage,
            chunks: [...lastMessage.chunks, chunk],
            isComplete: chunk.isComplete,
          };
          return updatedMessages;
        }

        return [
          ...prevMessages,
          {
            isAiResponse: true,
            timestamp: new Date(),
            sender: "AI Assistant",
            chunks: [chunk],
            isComplete: chunk.isComplete,
          },
        ];
      });
    });

    socket.on("systemMessage", (message) => {
      console.log("System message:", message);
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          ...message,
          isSystem: true,
        },
      ]);
    });

    return () => {
      socket.off("connect");
      socket.off("messageChunk");
      socket.off("systemMessage");
    };
  }, []);

  const handleSetName = () => {
    if (name.trim() !== "") {
      socket.emit("setName", name);
      console.log("Name set:", name);
      setShowNamePopup(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      if (showNamePopup) {
        handleSetName();
      } else {
        sendMessage();
      }
    }
  };

  const sendMessage = () => {
    if (messageInput.trim() !== "") {
      const userMessage = {
        text: messageInput,
        timestamp: new Date(),
        sender: name,
      };
      console.log("Sending message:", userMessage);

      socket.emit("message", userMessage, (response) => {
        console.log("Backend response received:", response);
      });

      setMessages((prev) => [...prev, userMessage]);
      setMessageInput("");
    } else {
      console.log("Message input is empty. Not sending.");
    }
  };

  const renderChunk = (chunk) => {
    switch (chunk.type) {
      case "text":
        return (
          <div style={chunk.style} className="mb-2">
            <Typewriter
              options={{
                strings: [chunk.data],
                autoStart: true,
                delay: 50, 
                cursor: "_", 
                loop: false,
                pauseFor:1000000
              }}
            />
          </div>
        );
      case "image":
        return (
          <img
            src={chunk.data}
            alt={chunk.alt}
            style={chunk.style}
            className="rounded-lg mb-2"
          />
        );
      case "button":
        return (
          <button
            onClick={() => {
              if (chunk.action?.type === "navigate") {
                window.location.href = chunk.action.target;
              }
            }}
            className="px-4 py-2 rounded-md mb-2 hover:opacity-90 transition-opacity"
            style={{
              backgroundColor: chunk.style?.backgroundColor || "#4299E1",
              color: chunk.style?.color || "#FFFFFF",
              ...chunk.style,
            }}
          >
            {chunk.data}
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex justify-center items-center w-full h-screen bg-gradient-to-b from-blue-300 to-blue-200">
      {showNamePopup && (
        <div className="fixed inset-0 flex justify-center items-center bg-gray-800 bg-opacity-50">
          <div className="bg-white p-6 rounded-md shadow-lg text-center">
            <h2 className="text-xl font-bold mb-4">Enter Your Name</h2>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
            />
            <button
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              onClick={handleSetName}
            >
              Start Chatting
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg w-96 h-96 p-4 shadow-md">
        <div className="flex flex-col h-full">
          <div className="flex-1 p-2 overflow-y-auto bg-gray-100 rounded-md">
            {messages.map((msg, index) => (
              <div key={index} className="mb-4">
                {msg.isSystem ? (
                  <div className="text-center text-gray-500 text-sm py-1">
                    {msg.text}
                  </div>
                ) : msg.isAiResponse ? (
                  <div className="flex flex-col">
                    <div className="max-w-[80%]">
                      <div className="text-xs font-medium text-gray-600 mb-1">
                        AI Assistant
                      </div>
                      <div className="bg-gray-300 text-gray-800 rounded-lg p-3">
                        {msg.chunks.map((chunk, i) => (
                          <div key={i}>{renderChunk(chunk)}</div>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="max-w-[80%] ml-auto">
                      <div className="text-xs font-medium text-gray-600 mb-1 text-right">
                        {msg.sender}
                      </div>
                      <div className="bg-blue-500 text-white px-3 py-2 rounded-lg">
                        <div>{msg.text}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 text-right">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-2 border-t border-gray-300">
            <div className="flex">
              <input
                type="text"
                className="w-full px-2 py-1 border rounded-l-md outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type your message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!isConnected || showNamePopup}
              />
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 transition-colors disabled:bg-gray-400"
                onClick={sendMessage}
                disabled={!isConnected || showNamePopup}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;
