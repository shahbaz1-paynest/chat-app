import { useState, useEffect, useRef } from "react";

const renderMessageChunk = (chunk) => {
  switch (chunk.type) {
    case "text":
      return `<span>${chunk.data}</span>`;

    case "image":
      return `
        <div class="my-4">
          <img 
            src="${chunk.data}" 
            alt="${chunk.metadata?.alt || 'Image'}" 
            class="rounded-lg shadow-md mb-2 max-w-full max-h-[300px]" 
          />
          ${chunk.metadata?.caption ? 
            `<span class="text-xs text-gray-500 italic block">${chunk.metadata.caption}</span>` 
            : ''}
        </div>`;

    case "button":
      if (!chunk.metadata?.url) return ''; // Skip if no URL provided

      const iconHtml = chunk.metadata?.icon?.url ?
        `<img 
          src="${chunk.metadata.icon.url}" 
          alt="${chunk.metadata.icon.alt || ''}" 
          class="inline-block mr-2 w-4 h-4"
        />` : '';

      return `
        <div class="my-4">
          <a 
            href="${chunk.metadata.url}" 
            target="${chunk.metadata.target || '_self'}" 
            rel="noopener noreferrer"
            class="inline-flex items-center bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
          >
            ${iconHtml}${chunk.data}
          </a>
        </div>`;

    default:
      console.warn(`Unhandled chunk type: ${chunk.type}`);
      return '';
  }
};

function Chat() {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const messageBufferRef = useRef({
    currentId: null,
    html: "",
    chunks: []
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8000/ws/chat/");
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected");
    };

    socket.onmessage = (event) => {
      try {
        const chunk = JSON.parse(event.data);
        console.log("Received chunk:", chunk);
    
        if (!messageBufferRef.current.currentId) {
          messageBufferRef.current = {
            currentId: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            html: "",
            chunks: []
          };
        }
    
        messageBufferRef.current.chunks.push(chunk);
    
        const chunkHtml = renderMessageChunk(chunk);
        messageBufferRef.current.html += chunkHtml;
    
        setMessages(prev => {
          const updatedMessages = [...prev];
          const lastMessage = updatedMessages[updatedMessages.length - 1];
    
          if (chunk.is_complete) {
            if (lastMessage?.id === messageBufferRef.current.currentId) {
              lastMessage.html = messageBufferRef.current.html;
            } else {
              updatedMessages.push({
                id: messageBufferRef.current.currentId,
                isAiResponse: true,
                html: messageBufferRef.current.html
              });
            }
            messageBufferRef.current = { currentId: null, html: "", chunks: [] }; 
            return updatedMessages;
          } else {
            if (lastMessage?.id === messageBufferRef.current.currentId) {
              lastMessage.html = messageBufferRef.current.html;
              return updatedMessages;
            }
            return [...prev, {
              id: messageBufferRef.current.currentId,
              isAiResponse: true,
              html: messageBufferRef.current.html
            }];
          }
        });
    
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
    
    socket.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket disconnected");
      messageBufferRef.current = {
        currentId: null,
        html: "",
        chunks: []
      };
    };

    return () => {
      socket.close();
    };
  }, []);

  const sendMessage = () => {
    if (messageInput.trim() !== "" && socketRef.current) {
      const userMessage = {
        id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,  // Combine timestamp with random value
        isAiResponse: false,
        text: messageInput
      };

      setMessages(prev => [...prev, userMessage]);

      socketRef.current.send(
        JSON.stringify({ message: messageInput })
      );
      setMessageInput("");
    }
  };

  const renderMessage = (message) => {
    if (message.isAiResponse && message.html.trim() !== "") {  // Check if there's actual content to render
      return (
        <div key={message.id} className="flex flex-col items-start mb-4 max-w-[80%]">
          <div className="bg-gray-300 text-gray-800 rounded-lg p-3">
            <div dangerouslySetInnerHTML={{ __html: message.html }} />
          </div>
          <span className="text-xs text-gray-500 mt-1">AI Assistant</span>
        </div>
      );
    } else if (!message.isAiResponse) {
      return (
        <div key={message.id} className="flex flex-col items-end mb-4 max-w-[80%] ml-auto">
          <div className="bg-blue-500 text-white px-3 py-2 rounded-lg">
            {message.text}
          </div>
          <span className="text-xs text-gray-500 mt-1">You</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex justify-center items-center w-full h-screen bg-gradient-to-b from-blue-300 to-blue-200">
      <div className="bg-white rounded-lg w-full h-[calc(100vh-80px)] p-4 shadow-md flex flex-col">
        <div className="flex-1 p-2 overflow-y-auto bg-gray-100 rounded-md mb-14">
          {messages.map(message => renderMessage(message))}
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
              onKeyPress={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
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
