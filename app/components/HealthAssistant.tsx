"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  isError?: boolean;
};

const SUGGESTED_PROMPTS = [
  "How are my latest vital signs looking?",
  "What is normal SpO2 and heart rate in orbit?",
  "Why does microgravity affect cardiovascular health?",
];

function parseBold(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return (
        <strong
          key={i}
          className="font-semibold text-slate-900 dark:text-cyan-200"
        >
          {seg.slice(2, -2)}
        </strong>
      );
    }
    return seg;
  });
}

function FormattedMessage({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-0.5" />;
        }

        const isBullet =
          trimmed.startsWith("•") ||
          trimmed.startsWith("* ") ||
          trimmed.startsWith("- ");

        const content = isBullet
          ? trimmed.replace(/^[•*-]\s*/, "")
          : trimmed;

        const parts = parseBold(content);

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500 dark:bg-cyan-400" />
              <span>{parts}</span>
            </div>
          );
        }

        return <p key={idx}>{parts}</p>;
      })}
    </div>
  );
}

export default function HealthAssistant() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(
    null
  );

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-welcome",
      sender: "assistant",
      text: "Greetings, Commander. I am your ORBIT Health Assistant. How may I assist with your vital signs or space physiology today?",
      timestamp: "",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
const requestIdRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  type BotPosition = {
  x: number;
  y: number;
};

const [botPosition, setBotPosition] = useState<BotPosition | null>(null);

const botButtonRef = useRef<HTMLButtonElement>(null);
const dragStartRef = useRef<{
  pointerX: number;
  pointerY: number;
  startX: number;
  startY: number;
} | null>(null);

const didDragRef = useRef(false);

useEffect(() => {
  try {
    const saved = localStorage.getItem("orbit-assistant-position");

    if (saved) {
      const parsed = JSON.parse(saved) as BotPosition;

      if (
        Number.isFinite(parsed.x) &&
        Number.isFinite(parsed.y)
      ) {
        setBotPosition({
          x: Math.max(0, Math.min(parsed.x, window.innerWidth - 56)),
          y: Math.max(0, Math.min(parsed.y, window.innerHeight - 56)),
        });
      }
    }
  } catch {
    // If saved data is invalid, use the default position.
  }
}, []);

function handleBotPointerDown(
  event: React.PointerEvent<HTMLButtonElement>
) {
  if (event.button !== 0) return;

  const rect = event.currentTarget.getBoundingClientRect();

  dragStartRef.current = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    startX: rect.left,
    startY: rect.top,
  };

  didDragRef.current = false;
  event.currentTarget.setPointerCapture(event.pointerId);
}

function handleBotPointerMove(
  event: React.PointerEvent<HTMLButtonElement>
) {
  const start = dragStartRef.current;
  if (!start) return;

  const deltaX = event.clientX - start.pointerX;
  const deltaY = event.clientY - start.pointerY;

  if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
    didDragRef.current = true;
  }

  if (!didDragRef.current) return;

  const x = Math.max(
    0,
    Math.min(start.startX + deltaX, window.innerWidth - 56)
  );

  const y = Math.max(
    0,
    Math.min(start.startY + deltaY, window.innerHeight - 56)
  );

  setBotPosition({ x, y });
}

function handleBotPointerUp(
  event: React.PointerEvent<HTMLButtonElement>
) {
  dragStartRef.current = null;

  try {
    const rect = event.currentTarget.getBoundingClientRect();

    const position = {
      x: rect.left,
      y: rect.top,
    };

    setBotPosition(position);

    localStorage.setItem(
      "orbit-assistant-position",
      JSON.stringify(position)
    );
  } catch {
    // Position saving is optional.
  }
}

  // Set initial timestamp on mount to prevent SSR/prerender dynamic date warnings
  useEffect(() => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === "initial-welcome" && !msg.timestamp
          ? {
              ...msg,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }
          : msg
      )
    );
  }, []);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      textareaRef.current?.focus();
    }
  }, [isOpen, messages, isLoading]);

  // Handle keyboard Esc key to close panel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);
function stopGeneration() {
  // Invalidate the current request before aborting it.
  requestIdRef.current += 1;

  activeRequestRef.current?.abort();
  activeRequestRef.current = null;

  setIsLoading(false);
  setError(null);
  setLastFailedMessage(null);

  setMessages((prev) => [
    ...prev,
    {
      id: `stopped-${Date.now()}`,
      sender: "assistant",
      text: "Response generation stopped.",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
}
  async function sendMessage(textToSend?: string) {
    const rawMessage = textToSend ?? input;
    const trimmedMessage = rawMessage.trim();

    if (!trimmedMessage || isLoading) {
      return;
    }

    if (trimmedMessage.length > 2000) {
      setError("Message exceeds maximum allowed length of 2,000 characters.");
      return;
    }

    setError(null);
    setLastFailedMessage(null);

    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: trimmedMessage,
      timestamp: now,
    };
    ++requestIdRef.current;
    const controller = new AbortController();

activeRequestRef.current = controller;

setMessages((prev) => [...prev, userMsg]);
setInput("");
setIsLoading(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({ message: trimmedMessage }),
      });

      if (response.status === 401) {
        setError("Your session has expired. Redirecting to login...");
        setTimeout(() => {
          router.push("/login");
        }, 1500);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Failed to receive a response from ORBIT Assistant."
        );
      }

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text:
          data.reply ??
          "I was unable to process your request. Please try again.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errText =
        err instanceof Error
          ? err.message
          : "An unexpected network error occurred.";
      setError(errText);
      setLastFailedMessage(trimmedMessage);

      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: `Error: ${errText}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isError: true,
      };

      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleRetry() {
    if (lastFailedMessage) {
      sendMessage(lastFailedMessage);
    }
  }

  return (
    <>
      {/* FLOATING BOT TOGGLE BUTTON (WITH POINTER CURSOR) */}
      <div
  className="fixed z-40"
  style={
    botPosition
      ? {
          left: botPosition.x,
          top: botPosition.y,
        }
      : {
          right: 24,
          bottom: 24,
        }
  }
>
  <button
    ref={botButtonRef}
    type="button"
    onPointerDown={handleBotPointerDown}
    onPointerMove={handleBotPointerMove}
    onPointerUp={handleBotPointerUp}
    onPointerCancel={handleBotPointerUp}
    onClick={() => {
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }

      setIsOpen((prev) => !prev);
    }}
    aria-expanded={isOpen}
    aria-haspopup="dialog"
    aria-label={
      isOpen
        ? "Close ORBIT Health Assistant"
        : "Open ORBIT Health Assistant"
    }
    title="Drag to move · Click to open"
    style={{ touchAction: "none" }}
    className="group relative flex h-14 w-14 cursor-grab items-center justify-center rounded-full border border-cyan-400/40 bg-slate-900 text-cyan-400 shadow-lg shadow-cyan-950/40 transition-all duration-300 hover:scale-105 hover:border-cyan-300 hover:shadow-cyan-500/25 active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 dark:bg-slate-900 dark:border-cyan-500/40 dark:text-cyan-300 dark:focus-visible:ring-offset-slate-950"
  >
          {/* Status pulse dot */}
          <span className="absolute -top-1 -right-1 flex h-4 w-4 pointer-events-none">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-slate-900 bg-cyan-500" />
          </span>

          {isOpen ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
              <path d="M7 12h.01M17 12h.01" />
            </svg>
          )}
        </button>
      </div>

      {/* CHAT PANEL MODAL / DIALOG */}
      {isOpen && (
        <section
          ref={chatContainerRef}
          role="dialog"
          aria-label="ORBIT Health Assistant"
          aria-modal="false"
          className="fixed bottom-24 right-4 sm:right-6 z-40 flex h-[540px] max-h-[calc(100vh-7rem)] w-[calc(100vw-2rem)] sm:w-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl backdrop-blur-xl transition-all duration-200 dark:border-slate-800 dark:bg-slate-950/95"
        >
          {/* HEADER */}
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19 12a7 7 0 1 0-14 0" />
                  <path d="M12 2v3M12 19v3" />
                </svg>
                <span
                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
                  title="Flight Surgeon AI Online"
                />
              </div>

              <div>
                <h2 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-white">
                  Astro
                </h2>
                <p className="text-[11px] font-medium tracking-wider text-cyan-600 dark:text-cyan-400 uppercase">
                  Your AI Assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Reset session button */}
              <button
                type="button"
                onClick={() =>
                  setMessages([
                    {
                      id: `welcome-${Date.now()}`,
                      sender: "assistant",
                      text: "Session refreshed. How may I assist with your vital signs or space physiology today?",
                      timestamp: new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    },
                  ])
                }
                title="Reset conversation"
                aria-label="Reset conversation"
                className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
              </button>

              {/* Explicit on-screen Close button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close chat window (or press Esc on keyboard)"
                aria-label="Close assistant"
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-xs transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
              >
                <span>Close</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </header>

          {/* MEDICAL DISCLAIMER NOTICE */}
          <div className="shrink-0 border-b border-slate-100 bg-amber-500/5 px-3 py-1.5 text-[11px] text-amber-700 dark:border-slate-800/60 dark:bg-amber-400/5 dark:text-amber-300">
            <span className="font-semibold">Notice:</span> Educational guidance
            only. Not a clinical diagnosis. In emergencies, contact Flight
            Surgeon control.
          </div>

          {/* SCROLLABLE MESSAGE THREAD */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-sm">
            {messages.map((msg) => {
              const isUser = msg.sender === "user";

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isUser ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                      isUser
                        ? "bg-cyan-600 text-white rounded-tr-xs"
                        : msg.isError
                        ? "border border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 rounded-tl-xs"
                        : "border border-slate-200/80 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 rounded-tl-xs"
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed font-sans text-xs sm:text-sm">
                        {msg.text}
                      </p>
                    ) : (
                      <FormattedMessage text={msg.text} />
                    )}
                  </div>

                  <span className="mt-1 px-1 text-[10px] text-slate-400 dark:text-slate-500">
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}

            {/* TYPING / LOADING INDICATOR */}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-xs border border-slate-200/80 bg-slate-100 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500" />
                  <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Analyzing telemetry...
                  </span>
                </div>
              </div>
            )}

            {/* SUGGESTED PROMPTS (only if single initial message) */}
            {messages.length === 1 && !isLoading && (
              <div className="pt-2">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Suggested telemetry questions
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 transition hover:border-cyan-500 hover:bg-cyan-500/5 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-400/10 dark:hover:text-cyan-300"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* RETRY BUTTON ON ERROR */}
            {error && lastFailedMessage && !isLoading && (
              <div className="flex items-center justify-between rounded-xl border border-rose-300/80 bg-rose-50/80 p-2.5 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                <span>Request could not be delivered.</span>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="cursor-pointer rounded-lg bg-rose-600 px-3 py-1 font-medium text-white transition hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600"
                >
                  Retry
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT & SEND CONTROLS */}
          <footer className="shrink-0 border-t border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="relative flex flex-col gap-1"
            >
              <div className="relative flex items-end rounded-xl border border-slate-300 bg-white transition-within focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:focus-within:border-cyan-400 dark:focus-within:ring-cyan-400">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={input}
                  maxLength={2000}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about vitals, symptoms, or space physiology..."
                  aria-label="Ask ORBIT Health Assistant"
                  disabled={isLoading}
                  className="w-full resize-none bg-transparent px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none disabled:opacity-50 dark:text-white dark:placeholder-slate-500"
                />

               {isLoading ? (
  <button
    type="button"
    onClick={stopGeneration}
    aria-label="Stop response generation"
    title="Stop generating"
    className="m-1.5 flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 text-white transition hover:bg-rose-700"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
    <span className="text-xs font-medium">Stop</span>
  </button>
) : (
  <button
    type="submit"
    disabled={!input.trim()}
    aria-label="Send question"
    className="m-1.5 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-cyan-600 text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  </button>
)}
              </div>

              <div className="flex items-center justify-between px-1 text-[10px] text-slate-400 dark:text-slate-500">
                <span>Enter to send · Shift+Enter for new line</span>
                <span
                  className={
                    input.length > 1900
                      ? "text-rose-500 font-semibold"
                      : undefined
                  }
                >
                  {input.length}/2000
                </span>
              </div>
            </form>
          </footer>
        </section>
      )}
    </>
  );
}
