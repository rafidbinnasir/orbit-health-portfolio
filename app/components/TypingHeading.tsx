"use client";

import { useEffect, useState } from "react";

const messages = [
  "Good luck, Captain!🚀",
  "Your Health Monitoring Dashboard",
  "Stay Sharp. Stay Healthy. Reach For The Stars.",
];

export default function TypingHeading() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    const currentMessage = messages[messageIndex];

    if (isWaiting) {
      const waitTimer = window.setTimeout(() => {
        setMessageIndex((index) => (index + 1) % messages.length);
        setDisplayedText("");
        setIsWaiting(false);
      }, 5000);

      return () => window.clearTimeout(waitTimer);
    }

    if (displayedText.length < currentMessage.length) {
      const typingTimer = window.setTimeout(() => {
        setDisplayedText(
          currentMessage.slice(0, displayedText.length + 1)
        );
      }, 65);

      return () => window.clearTimeout(typingTimer);
    }

    const finishTimer = window.setTimeout(() => {
      setIsWaiting(true);
    }, 0);

    return () => window.clearTimeout(finishTimer);
  }, [displayedText, messageIndex, isWaiting]);

  return (
    <h1 className="mt-2 min-h-[5rem] text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:min-h-[3rem] sm:text-4xl">
      <span>{displayedText}</span>
      <span
        aria-hidden="true"
        className="ml-1 inline-block h-8 w-[2px] animate-pulse bg-cyan-500 dark:bg-cyan-400 align-middle sm:h-9"
      />
    </h1>
  );
}
