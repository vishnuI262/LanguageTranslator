import { useState, useEffect, useRef } from "react";
import axios from "axios";
import styles from "./App.module.css";
import { Paperclip, ChevronLeft, ChevronRight } from "lucide-react";

function App() {
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState([]);
  const [previewFileName, setPreviewFileName] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat]);

  const handleSend = async () => {
    const hasFile = !!file;
    const hasQuestion = question.trim() !== "";

    if (!hasFile && !hasQuestion) {
      return alert("Type a message or attach a file!");
    }

    setIsLoading(true);

    if (hasFile) {
      const formData = new FormData();
      formData.append("file", file);
      const currentFileName = previewFileName;
      setFile(null);
      setPreviewFileName("");

      const userFileMsg = {
        type: "user",
        text: `Sent a file: ${currentFileName}`,
      };
      setChat((prev) => [...prev, userFileMsg]);

      try {
        const res = await axios.post("http://localhost:5000/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const aiMsg = { type: "ai", text: res.data.translated };
        setChat((prev) => [...prev, aiMsg]);
      } catch (err) {
        console.error(err);
        alert("File upload failed!");
      }
    }

    if (hasQuestion) {
      const userMsg = { type: "user", text: question };
      setChat((prev) => [...prev, userMsg]);
      setQuestion("");

      try {
        const res = await axios.post("http://localhost:5000/ask", { question });
        const aiMsg = { type: "ai", text: res.data.answer };
        setChat((prev) => [...prev, aiMsg]);
      } catch (err) {
        console.error(err);
        alert("Question failed!");
      }
    }

    setIsLoading(false);
  };

  return (
    <div className={styles.appWrapper}>
      {/* Sidebar */}
      <div
        className={`${styles.sidebar} ${
          !isSidebarOpen ? styles.sidebarClosed : ""
        }`}
      >
        <div className={styles.sidebarHeader}>
          {isSidebarOpen && <h2 className={styles.logo}>AI Assistant</h2>}
          <button
            className={styles.toggleBtn}
            onClick={() => setIsSidebarOpen((prev) => !prev)}
          >
            {isSidebarOpen ? (
              <ChevronLeft size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
        </div>

        {isSidebarOpen && (
          <div className={styles.sidebarContent}>
            <div className={styles.language}>🌐 English</div>
            <div className={styles.nav}>
              <div className={styles.navItemActive}>💬 New Chat</div>
              <div className={styles.navItem}>📁 Documents</div>
            </div>
            {/* <button className={styles.uploadBtn}>⬆️ Upload Documents</button> */}
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div
        className={`${styles.chatMain} ${
          !isSidebarOpen ? styles.chatExpanded : ""
        }`}
      >
        {/* Header */}
        <div className={styles.chatHeader}>
          <h1>AI Assistant Chat</h1>
          <p>Ask me anything or upload documents for analysis</p>
        </div>

        {/* Chat Messages - Scrollable Area */}
        <div className={styles.chatMessagesContainer}>
          <div className={styles.chatMessages}>
            {chat.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.type === "user" ? styles.userBubble : styles.aiBubble
                }
              >
                {msg.text}
              </div>
            ))}

            {isLoading && (
              <div className={styles.aiBubble}>
                <div className={styles.loadingDots}>
                  <div className={styles.dot}></div>
                  <div className={styles.dot}></div>
                  <div className={styles.dot}></div>
                </div>
              </div>
            )}

            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className={styles.chatInputContainer}>
          {/* File Preview */}
          {previewFileName && (
            <div className={styles.filePreview}>
              <span>📄 {previewFileName}</span>
              <button
                className={styles.removeFileButton}
                onClick={() => {
                  setFile(null);
                  setPreviewFileName("");
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Input Row */}
          <div className={styles.chatInputWrapper}>
            <label className={styles.attachmentIcon}>
              <Paperclip size={20} />
              <input
                type="file"
                accept=".txt,.pdf"
                onChange={(e) => {
                  const selected = e.target.files[0];
                  if (selected) {
                    setFile(selected);
                    setPreviewFileName(selected.name);
                    e.target.value = null;
                  }
                }}
                className={styles.hiddenInput}
              />
            </label>

            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Type your message..."
              className={styles.questionInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isLoading}
            />

            <button
              className={styles.askButton}
              onClick={handleSend}
              disabled={isLoading}
            >
              {isLoading ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
