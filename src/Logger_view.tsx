import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { CB } from "../electron/render";
import { ActionType, useStore } from "./store/app.store";

type LogLevel = "info" | "error" | "warn" | "table";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
}

const MAX_LOGS = 100;

const formatDate = (date: Date): string => {
  const pad = (num: number) => num.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
};

const LogTerminal: React.FC = () => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [detail, setDetail] = useState("N/A");
  const { dispatch } = useStore();
  const addLog = useCallback((newLog: LogEntry | LogEntry[]) => {
    setLogs((prevLogs) => {
      const logsToAdd = Array.isArray(newLog) ? newLog : [newLog];
      return [...prevLogs, ...logsToAdd].slice(-MAX_LOGS);
    });
  }, []);
  console.log("Logge View render");

  useEffect(() => {
    const handleEvent: CB = (type, message) => {
      const level: LogLevel =
        type === "error" ? "error" : type === "warn" ? "warn" : "info";

      switch (type) {
        case "data":
          console.log("data", message);
          addLog(message as LogEntry[]);

          break;
        case "details":
        case "error":
        case "warn":
          console.log("details", message);

          addLog({
            level,
            message: String(message),
            timestamp: formatDate(new Date()),
          });
          break;
        case "count":
          setDetail(typeof message === "string" ? message : "N/A");
          break;
        case "progress":
          setProgress(message as unknown as number);
          break;
        case "complete":
          dispatch({ type: ActionType.SET_STATUS, payload: "idle" });
          setProgress(0);
          break;
        default:
          console.warn("Unhandled event type:", type);
      }
    };

    window.MyApi.OnEvent = handleEvent;

    return () => {
      window.MyApi.OnEvent = null;
    };
  }, [addLog, dispatch]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = useMemo(
    () =>
      (level: LogLevel): string => {
        switch (level) {
          case "info":
            return "text-blue-400";
          case "warn":
            return "text-yellow-400";
          case "error":
            return "text-red-400";
          default:
            return "text-gray-400";
        }
      },
    []
  );

  const [progress, setProgress] = useState<number>(0);

  return (
    <div className="mt-3">
      <h1 className="mt-3 mb-4 text-xl">{detail}</h1>
      <div  ref={logContainerRef} className="bg-gray-900 text-white font-mono p-4 rounded-lg shadow-lg w-full h-[400px] overflow-y-auto">
        {logs.map((log, index) => (
          <div key={index} className="mb-1">
            {log.timestamp && (
              <span className="text-gray-500">[{log.timestamp}]</span>
            )}
            <span
              className={`font-bold ${getLogColor(log.level)} ${
                log.level === "table" ? "" : "uppercase"
              }`}
            >
              {log.level === "table" ? "" : `${log.level}:`}
            </span>
            <span className={log.level === "table" ? "text-sm" : ""}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
      {/* Progress Bar */}

      <div className="w-[90%] bg-gray-200 mt-4 rounded-full h-4 mb-3">
        <div
          className="bg-blue-600 h-4 rounded-full"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

export default LogTerminal;
