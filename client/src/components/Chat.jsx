import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

const socket = io("localhost:8000/");

function Chat() {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
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

    socket.on("response", (chunk) => {
      console.log("Received chunk:", chunk);

      setMessages((prevMessages) => {
        const lastMessage = prevMessages[prevMessages.length - 1];

        if (lastMessage?.isAiResponse && !lastMessage.isComplete) {
          const updatedMessages = [...prevMessages];
          const updatedChunks = [...lastMessage.chunks, chunk];
          
          updatedMessages[updatedMessages.length - 1] = {
            ...lastMessage,
            chunks: updatedChunks,
            isComplete: chunk.is_complete
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
            isComplete: chunk.is_complete
          },
        ];
      });
    });

    return () => {
      socket.off("connect");
      socket.off("response");
    };
  }, []);

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  const sendMessage = () => {
    if (messageInput.trim() !== "") {
      socket.emit("message", {
        message: messageInput
      });

      setMessages((prev) => [...prev, {
        text: messageInput,
        timestamp: new Date(),
        sender: "You",
      }]);
      
      setMessageInput("");
    }
  };

  const renderList = (chunks, startIndex) => {
    const listChunks = [];
    let currentMetadata = null;
    let i = startIndex;

    while (i < chunks.length && chunks[i].type === "list") {
      listChunks.push(chunks[i]);
      if (!currentMetadata) currentMetadata = chunks[i].metadata;
      if (chunks[i].metadata?.is_list_completed) break;
      i++;
    }

    if (listChunks.length === 0) return { content: null, nextIndex: startIndex };

    const ListTag = currentMetadata?.ordered ? "ol" : "ul";
    const listStyle = currentMetadata?.style === "bulleted" ? "list-disc" : "list-decimal";
    
    const uniqueItems = new Set();
    listChunks.forEach(chunk => {
      chunk.data.forEach(item => uniqueItems.add(item));
    });

    return {
      content: (
        <ListTag className={`pl-6 mb-2 ${listStyle}`}>
          {Array.from(uniqueItems).map((item, index) => (
            <li key={index} className="mb-1">{item}</li>
          ))}
        </ListTag>
      ),
      nextIndex: i + 1
    };
  };

  const renderTable = (chunks, startIndex) => {
    const tableChunks = [];
    let currentMetadata = null;
    let headers = null;
    let i = startIndex;

    while (i < chunks.length && chunks[i].type === "table") {
      tableChunks.push(chunks[i]);
      if (!currentMetadata) {
        currentMetadata = chunks[i].metadata;
        headers = chunks[i].data.headers;
      }
      if (chunks[i].metadata?.is_table_completed) break;
      i++;
    }

    if (tableChunks.length === 0) return { content: null, nextIndex: startIndex };

    const uniqueRows = new Set();
    tableChunks.forEach(chunk => {
      chunk.data.rows.forEach(row => {
        uniqueRows.add(JSON.stringify(row));
      });
    });

    const rows = Array.from(uniqueRows).map(row => JSON.parse(row));

    return {
      content: (
        <div className="mb-4 overflow-x-auto">
          {currentMetadata?.caption && (
            <div className="text-sm font-medium mb-2">{currentMetadata.caption}</div>
          )}
          <table className={`min-w-full border-collapse ${
            currentMetadata?.style === "striped" ? "even:bg-gray-50" : ""
          }`}>
            <thead>
              <tr className="bg-gray-100">
                {headers.map((header, index) => (
                  <th key={index} className="border px-4 py-2 text-left">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border px-4 py-2">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
      nextIndex: i + 1
    };
  };

  const renderMessage = (chunks) => {
    let content = [];
    let currentText = "";
    let i = 0;

    while (i < chunks.length) {
      const chunk = chunks[i];

      switch (chunk.type) {
        case "text":
          currentText += chunk.data + " ";
          i++;
          break;

        case "table":
          if (currentText) {
            content.push(<p key={`text-${i}`} className="mb-2">{currentText}</p>);
            currentText = "";
          }
          const tableResult = renderTable(chunks, i);
          if (tableResult.content) {
            content.push(tableResult.content);
          }
          i = tableResult.nextIndex;
          break;

        case "list":
          if (currentText) {
            content.push(<p key={`text-${i}`} className="mb-2">{currentText}</p>);
            currentText = "";
          }
          const listResult = renderList(chunks, i);
          if (listResult.content) {
            content.push(listResult.content);
          }
          i = listResult.nextIndex;
          break;

        case "button":
          if (currentText) {
            content.push(<p key={`text-${i}`} className="mb-2">{currentText}</p>);
            currentText = "";
          }
          content.push(
            <a
              key={`button-${i}`}
              href={chunk.metadata?.url}
              target={chunk.metadata?.target || "_self"}
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors mb-2"
            >
              {chunk.metadata?.icon?.position === "left" && chunk.metadata?.icon?.url && (
                <img
                  src={chunk.metadata.icon.url}
                  alt={chunk.metadata.icon.alt || "Icon"}
                  className="w-4 h-4 mr-2"
                />
              )}
              {chunk.data}
              {chunk.metadata?.icon?.position === "right" && chunk.metadata?.icon?.url && (
                <img
                  src={chunk.metadata.icon.url}
                  alt={chunk.metadata.icon.alt || "Icon"}
                  className="w-4 h-4 ml-2"
                />
              )}
            </a>
          );
          i++;
          break;

        case "image":
          if (currentText) {
            content.push(<p key={`text-${i}`} className="mb-2">{currentText}</p>);
            currentText = "";
          }
          content.push(
            <div key={`image-${i}`} className="mb-4 flex flex-col items-left">
              <img
                src={chunk.data}
                alt={chunk.metadata?.alt || "Image"}
                className="rounded-lg shadow-md mb-2 w-[500px]"
              />
              {chunk.metadata?.caption && (
                <span className="text-sm text-gray-600 italic">{chunk.metadata.caption}</span>
              )}
            </div>
          );
          i++;
          break;

        default:
          i++;
          break;
      }
    }

    if (currentText) {
      content.push(<p key="final-text" className="mb-2">{currentText}</p>);
    }

    return content;
  };

  return (
    <div className="flex justify-center items-center w-full h-screen bg-gradient-to-b from-blue-300 to-blue-200">
      <div className="bg-white rounded-lg w-full h-[calc(100vh-80px)] p-4 shadow-md flex flex-col">
        <div className="flex-1 p-2 overflow-y-auto bg-gray-100 rounded-md mb-14">
          {messages.map((msg, index) => (
            <div key={index} className="mb-4">
              {msg.isAiResponse ? (
                <div className="flex flex-col">
                  <div className="max-w-[80%]">
                    <div className="text-xs font-medium text-gray-600 mb-1">
                      AI Assistant
                    </div>
                    <div className="bg-gray-300 text-gray-800 rounded-lg p-3">
                      {renderMessage(msg.chunks)}
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

        <div className="fixed bottom-0 left-0 w-full p-2 bg-white border-t border-gray-300">
          <div className="flex">
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-l-md outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type your message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!isConnected}
            />
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 transition-colors disabled:bg-gray-400"
              onClick={sendMessage}
              disabled={!isConnected}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;