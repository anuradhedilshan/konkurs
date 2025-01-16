import { useEffect, useState } from "react";

const ProcessingProgressBar = ({
  progress = 0,
  isComplete = false,
  Status,
}: {
  isComplete: boolean;
  Status: "idle" | "running";
  progress: number;
}) => {
  const [showProcessing, setShowProcessing] = useState(false);

  useEffect(() => {
    if (!isComplete) {
      setShowProcessing(true);
    } else {
      setShowProcessing(false);
    }
  }, [progress, isComplete]);

  return (
    <div className="w-full">
      <div className="w-[90%] bg-gray-200 mt-4 rounded-full h-4 mb-3 overflow-hidden relative">
        <div
          className={`h-4 rounded-full transition-all duration-300 ${
            showProcessing ? "bg-blue-400 animate-pulse" : "bg-blue-600"
          }`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />

        {showProcessing && (
          <div
            className="absolute top-0 left-0 h-full w-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)",
              animation: "shimmer 1.5s infinite",
              backgroundSize: "200% 100%",
            }}
          />
        )}
      </div>

      {Status == "running" && (
        <p className="text-sm text-gray-600">Processing...</p>
      )}
    </div>
  );
};

export default ProcessingProgressBar;
