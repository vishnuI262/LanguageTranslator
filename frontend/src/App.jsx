import { useState } from "react";
import axios from "axios";
import styles from "./App.module.css";
import { FiPaperclip, FiChevronLeft, FiChevronRight } from "react-icons/fi";

function App() {
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState([]);
  const [previewFileName, setPreviewFileName] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const handleSend = async () => {
    const hasFile = !!file;
    const hasQuestion = question.trim() !== "";

    if (!hasFile && !hasQuestion) {
      return alert("Type a message or attach a file!");
    }

    if (hasFile) {
      const formData = new FormData();
      formData.append("file", file);
      setFile(null);
      setPreviewFileName("");

      const userFileMsg = {
        type: "user",
        text: `📎 Sent a file: ${previewFileName}`,
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
  };

  return (
    <div className={styles.appWrapper}>
      {/* Sidebar */}
      <div
        className={`${styles.sidebar} ${
          !isSidebarOpen ? styles.sidebarClosed : ""
        }`}
      >
        <>
          <div className={styles.sidebarHeader}>
            {isSidebarOpen && <h2 className={styles.logo}>AI Assistant</h2>}
            <button
              className={`${styles.toggleBtn} ${
                isSidebarOpen ? styles.sidebarIcon : styles.sidebarIconOpened
              }`}
              onClick={() => setIsSidebarOpen((prev) => !prev)}
            >
              {isSidebarOpen ? <FiChevronLeft /> : <FiChevronRight />}
            </button>
          </div>
          {isSidebarOpen && (
            <div>
              <div className={styles.language}>🌐 English</div>
              <div className={styles.nav}>
                <div className={styles.navItemActive}>💬 New Chat</div>
                <div className={styles.navItem}>📁 Documents</div>
              </div>
              <button className={styles.uploadBtn}>⬆️ Upload Documents</button>
            </div>
          )}
        </>
      </div>

      {/* Main Chat Area */}
      <div
        className={`${styles.chatMain} ${
          !isSidebarOpen ? styles.chatExpanded : ""
        }`}
      >
        <div className={styles.chatContentWrapper}>
          <div className={styles.chatHeader}>
            <h1>AI Assistant Chat</h1>
            <p>Ask me anything or upload documents for analysis</p>
          </div>

          <div className={styles.scrollArea}>
            <div className={styles.scrollAreaContent}>
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
            </div>
          </div>
        </div>

        {/* Chat Bar */}
        <div className={styles.chatBoxWrapper}>
          <div className={styles.chatBar}>
            <div className={styles.chatInputWrapper}>
              <label className={styles.attachmentIcon}>
                <FiPaperclip size={20} />
                <input
                  type="file"
                  accept=".txt,.pdf"
                  onChange={(e) => {
                    const selected = e.target.files[0];
                    if (selected) {
                      setFile(selected);
                      setPreviewFileName(selected.name);
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
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />

              <button className={styles.askButton} onClick={handleSend}>
                Send
              </button>

              {previewFileName && (
                <div className={styles.filePreview}>
                  📎 {previewFileName}
                  <button
                    className={styles.removeFileButton}
                    onClick={() => {
                      setFile(null);
                      setPreviewFileName("");
                    }}
                  >
                    ✖
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
