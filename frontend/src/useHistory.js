import { useState, useCallback } from "react";

const KEY = "stem-splitter-history";
const MAX = 50;

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export default function useHistory() {
  const [history, setHistory] = useState(load);

  const addEntry = useCallback((entry) => {
    setHistory((prev) => {
      const next = [entry, ...prev.filter((e) => e.jobId !== entry.jobId)].slice(0, MAX);
      save(next);
      return next;
    });
  }, []);

  const removeEntry = useCallback((jobId) => {
    setHistory((prev) => {
      const next = prev.filter((e) => e.jobId !== jobId);
      save(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(KEY);
  }, []);

  return { history, addEntry, removeEntry, clearHistory };
}
