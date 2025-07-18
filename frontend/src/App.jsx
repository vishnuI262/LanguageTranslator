import { useState, useEffect, useRef } from "react";
import styles from "./App.module.css";
import { Paperclip, ChevronLeft, ChevronRight } from "lucide-react";

function App() {
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const dropdownRef = useRef(null);

  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const documentsBtnRef = useRef(null);
  const documentsPopupRef = useRef(null);
  const [currentChat, setCurrentChat] = useState([]);

  const [conversations, setConversations] = useState([]);
  const [previewFileName, setPreviewFileName] = useState("");

  const [editingIndex, setEditingIndex] = useState(null);
  const [renameText, setRenameText] = useState("");

  const [hoverIndex, setHoverIndex] = useState(null);
  const [menuOpenIndex, setMenuOpenIndex] = useState(null);

  const [documents, setDocuments] = useState([]);

  function formatMarkdown(text) {
    return text.replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="bold-text">$1</strong>'
    );
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    async function loadData() {
      try {
        // fetch chats
        const chatsRes = await fetch("http://localhost:5000/api/chats");
        const savedChats = await chatsRes.json();
        setConversations(
          savedChats.map((chat) => ({
            name: chat.title,
            messages: chat.messages,
          }))
        );

        // fetch documents
        const docsRes = await fetch("http://localhost:5000/documents");
        const savedDocs = await docsRes.json();
        setDocuments(savedDocs);
      } catch (error) {
        console.error("Failed to load saved data:", error);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentChat]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMenuOpenIndex(null);
      }
    };

    if (menuOpenIndex !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpenIndex]);

  const handleAskStream = async (questionToSend) => {
    try {
      const res = await fetch("http://localhost:5000/ask-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: questionToSend }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let resultText = "";

      setCurrentChat((prev) => [...prev, { type: "ai", text: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n").filter((line) => line.trim());

        for (const line of lines) {
          if (line === "data: [DONE]") {
            setIsLoading(false);
            return;
          }

          if (line.startsWith("data: ")) {
            const text = line.replace("data: ", "");
            resultText += text;

            setCurrentChat((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { type: "ai", text: resultText };
              return updated;
            });
          }
        }
      }
    } catch (err) {
      console.error("Streaming failed:", err);
      alert("Streaming failed!");
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    const hasFile = !!file;
    const hasQuestion = question.trim() !== "";

    if (!hasFile && !hasQuestion) {
      return alert("Type a message or attach a file!");
    }

    if (hasFile) {
      setIsLoading(true);

      const formData = new FormData();
      formData.append("file", file);
      const currentFileName = previewFileName;
      setFile(null);
      setPreviewFileName("");

      setCurrentChat((prev) => [
        ...prev,
        { type: "user", text: `📄 Sent a file: ${currentFileName}` },
      ]);

      try {
        const res = await fetch("http://localhost:5000/upload", {
          method: "POST",
          body: formData,
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let resultText = "";

        setCurrentChat((prev) => [...prev, { type: "ai", text: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n\n").filter((line) => line.trim());

          for (const line of lines) {
            if (line === "data: [DONE]") {
              setIsLoading(false);

              const docsRes = await fetch("http://localhost:5000/documents");
              const savedDocs = await docsRes.json();
              setDocuments(savedDocs);

              return;
            }

            if (line.startsWith("data: ")) {
              const text = line.replace("data: ", "");
              resultText += text;

              setCurrentChat((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { type: "ai", text: resultText };
                return updated;
              });
            }
          }
        }
      } catch (err) {
        console.error("File upload failed:", err);
        alert("File upload failed!");
        setIsLoading(false);
      }
    }

    if (hasQuestion) {
      setCurrentChat((prev) => [...prev, { type: "user", text: question }]);
      const q = question;
      setQuestion("");

      try {
        await handleAskStream(q);
      } catch (err) {
        console.error(err);
        alert("Question failed!");
        setIsLoading(false);
      }
    }
  };

  const handleRename = (index) => {
    setConversations((prev) => {
      const updated = [...prev];
      updated[index].name = renameText.trim() || updated[index].name;
      return updated;
    });
    setEditingIndex(null);
    setRenameText("");
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
              <div
                className={styles.navItemActive}
                onClick={async () => {
                  if (currentChat.length > 0) {
                    try {
                      const res = await fetch(
                        "http://localhost:5000/generate-title",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            messages: currentChat.slice(0, 4),
                          }),
                        }
                      );

                      const data = await res.json();
                      const generatedTitle =
                        data.title || `Chat ${conversations.length + 1}`;

                      setConversations((prev) => [
                        {
                          name: generatedTitle,
                          messages: currentChat,
                        },
                        ...prev,
                      ]);

                      await fetch("http://localhost:5000/api/save-chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          title: generatedTitle,
                          messages: currentChat,
                        }),
                      });
                    } catch (error) {
                      console.error("Title generation failed:", error);
                      setConversations((prev) => [
                        {
                          name: `Chat ${conversations.length + 1}`,
                          messages: currentChat,
                        },
                        ...prev,
                      ]);
                    }
                  }

                  setCurrentChat([]);
                }}
              >
                New Chat
              </div>

              <div
                ref={documentsBtnRef}
                className={styles.navItemActive}
                style={{
                  marginBottom: "1rem",
                  background: isDocumentsOpen ? "#407af6" : undefined,
                }}
                onClick={() => setIsDocumentsOpen((prev) => !prev)}
              >
                Documents
              </div>

              {isDocumentsOpen && (
                <div ref={documentsPopupRef} className={styles.documentsPopup}>
                  {documents.length === 0 ? (
                    <div className={styles.navItem}>No files uploaded</div>
                  ) : (
                    documents.map((doc, idx) => (
                      <div key={idx} className={styles.navItem}>
                        📄 {doc.name}
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className={styles.navItemTitle}>Past Conversations</div>
              {conversations.map((conv, index) => (
                <div
                  key={index}
                  className={styles.navItem}
                  onMouseEnter={() => setHoverIndex(index)}
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  {editingIndex === index ? (
                    <input
                      type="text"
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      onBlur={() => handleRename(index)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(index);
                      }}
                      autoFocus
                      className={styles.renameInput}
                    />
                  ) : (
                    <div className={styles.chatRow}>
                      <span
                        onClick={() => {
                          setCurrentChat(conversations[index].messages);
                        }}
                      >
                         {conv.name}
                      </span>

                      {hoverIndex === index && (
                        <div
                          className={styles.menuIcon}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenIndex(
                              index === menuOpenIndex ? null : index
                            );
                          }}
                        >
                          ⋯
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dropdown menu */}
                  {menuOpenIndex === index && (
                    <div ref={dropdownRef} className={styles.dropdownMenu}>
                      <div
                        onClick={() => {
                          setEditingIndex(index);
                          setRenameText(conv.name);
                          setMenuOpenIndex(null);
                        }}
                      >
                        Rename
                      </div>
                      <div
                        onClick={() => {
                          setConversations((prev) =>
                            prev.filter((_, i) => i !== index)
                          );
                          setMenuOpenIndex(null);
                        }}
                      >
                        Delete
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
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
            {currentChat.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.type === "user" ? styles.userBubble : styles.aiBubble
                }
              >
                <div
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.text) }}
                />
              </div>
            ))}

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
