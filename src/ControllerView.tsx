import React, { useState, useEffect } from "react";
import { ChevronDown, Loader2, AlertTriangle } from "lucide-react";
import { ActionType, useStore } from "./store/app.store";

// Interfaces matching the API response
interface Month {
  name: string;
  link: string;
}

interface YearData {
  name: string;
  months: Month[];
}

interface ApiResponse {
  years: YearData[];
  maxpages: number;
}

const UnifiedSelector: React.FC = () => {
  const { state, dispatch } = useStore();
  // Selection type state

  // API data states
  const [apiData, setApiData] = useState<ApiResponse>({
    years: [],
    maxpages: 10,
  });

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get All section states

  // Get Archived section states
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Fetch years and months from API
  const fetchYearsAndMonths = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await window.MyApi.fetchFilters();

      setApiData(response as unknown as ApiResponse);

      // Set initial states
      dispatch({ type: ActionType.SET_RANGE, payload: { start: 1, end: 2 } });
    } catch (err) {
      setError("Failed to load years and months");
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  // Initial data fetch
  useEffect(() => {
    fetchYearsAndMonths();
  }, [fetchYearsAndMonths]);

  // Handle selection type change
  const handleSelectionTypeChange = (type: "all" | "archived") => {
    dispatch({
      type: ActionType.SET_TYPE,
      payload: type,
    });

    // Reset other section's state
    if (type === "all") {
      dispatch({
        type: ActionType.SET_LINK,
        payload: "https://www.konkurs.ro/concursuri-terminate",
      });
      setSelectedYear("");
      setSelectedMonth("");
      dispatch({ type: ActionType.SET_RANGE, payload: { start: 1, end: 2 } });
    } else {
      dispatch({ type: ActionType.SET_RANGE, payload: { start: 0, end: 0 } });
    }

    // Trigger callback
    dispatch({ type: ActionType.SET_TYPE, payload: type });
  };

  // Handle page range changes for Get All
  const handlePageChange = (type: "start" | "end", value: number) => {
    // Ensure value is within available page range
    const safeValue = Math.max(1, Math.min(value, apiData.maxpages));

    if (type === "start") {
      dispatch({
        type: ActionType.SET_RANGE,
        payload: {
          start: safeValue,
          end: Math.max(safeValue, state.range.end),
        },
      });
    } else {
      // Ensure end page is not more than max available
      // Ensure start page is not more than end page
      dispatch({
        type: ActionType.SET_RANGE,
        payload: {
          start: Math.min(state.range.start, safeValue),
          end: Math.min(safeValue, apiData.maxpages),
        },
      });
    }
  };

  // Handle year selection
  const handleYearSelection = (year: string) => {
    setSelectedYear(year);
    setSelectedMonth("");

    // Trigger callback
    dispatch({ type: ActionType.SET_TYPE, payload: "archived" });
  };

  // Handle month selection
  const handleMonthSelection = (month: Month) => {
    setSelectedMonth(month.name);

    // Trigger callback
    dispatch({ type: ActionType.SET_TYPE, payload: "archived" });
    dispatch({ type: ActionType.SET_LINK, payload: month.link });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="animate-spin mr-2" />
        <span>Loading data...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center p-4 bg-red-50">
        <AlertTriangle className="text-red-500 mr-2" />
        <span className="text-red-700">{error}</span>
        <button
          onClick={fetchYearsAndMonths}
          className="ml-4 px-3 py-1 bg-blue-500 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white w-full">
      {/* Selection Type Buttons */}
      <div className="mb-4 flex space-x-2">
        <button
          onClick={() => handleSelectionTypeChange("all")}
          className={`px-4 py-2 rounded-md ${
            state.type === "all"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-blue-100"
          }`}
        >
          Get All
        </button>
        <button
          onClick={() => handleSelectionTypeChange("archived")}
          className={`px-4 py-2 rounded-md ${
            state.type === "archived"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-blue-100"
          }`}
        >
          Get Archived
        </button>
      </div>

      {/* Get All Section */}
      {state.type === "all" && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="start-page"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Start Page (Max: {apiData.maxpages})
            </label>
            <input
              id="start-page"
              type="number"
              min="1"
              max={apiData.maxpages}
              value={state.range.start}
              onChange={(e) =>
                handlePageChange("start", parseInt(e.target.value))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="end-page"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              End Page (Max: {apiData.maxpages})
            </label>
            <input
              id="end-page"
              type="number"
              min="1"
              max={apiData.maxpages}
              value={state.range.end}
              onChange={(e) =>
                handlePageChange("end", parseInt(e.target.value))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Get Archived Section */}
      {state.type === "archived" && (
        <div className="space-y-4">
          {/* Year Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Year
            </label>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => handleYearSelection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                <option value="">Select Year</option>
                {apiData.years.map((year) => (
                  <option key={year.name} value={year.name}>
                    {year.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* Month Selector */}
          {selectedYear && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Month
              </label>
              <div className="grid grid-cols-3 gap-2">
                {apiData.years
                  .find((y) => y.name === selectedYear)
                  ?.months.map((month) => (
                    <button
                      key={month.name}
                      onClick={() => handleMonthSelection(month)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                        selectedMonth === month.name
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-blue-100"
                      }`}
                    >
                      {month.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
      {/* File Input and Set Path Button */}
      <div className="flex items-center mb-2 mt-4">
        <input
          type="text"
          value={state.location}
          disabled
          placeholder="Set File Path"
          className="flex-1 p-1 bg-gray-100 border border-gray-300 rounded-md focus:outline-none"
        />
        <button
          className="ml-3 px-4 py-1 bg-blue-600 text-white rounded-md"
          onClick={async () => {
            console.log("click path open");
            const e = await window.MyApi.openFilePicker();
            dispatch({ type: ActionType.SET_FILE_PATH, payload: e });
          }}
        >
          Set Path
        </button>
      </div>
      <span>{state.location}</span>
    </div>
  );
};

export default UnifiedSelector;
