/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useReducer } from "react";

type States = {
  location: string;
  type: Type;
  range: { start: number; end: number };
  status: "idle" | "running";
  link: string;
};

enum ActionType {
  SET_STATUS,
  SET_TYPE,
  SETCOUNT,
  SETPROGRESS,
  SET_AS_COMPLETE,
  SET_FILE_PATH,
  SET_RUNNING_STATE,
  SET_RANGE,
  SET_WORKING_PROXY_LIST,
  SET_LOGGER_DATA,
  CLEAR_LOG,
  SET_FACETS,
  SET_FACETFilters,
  SET_LINK,
}

interface Action {
  type: ActionType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any; // You can specify the actual payload type based on the ActionType
}

function reducer(state: States, action: Action): States {
  console.log("reducer call", action);
  switch (action.type) {
    case ActionType.SET_FILE_PATH:
      return { ...state, location: action.payload };
    case ActionType.SET_RANGE:
      return { ...state, range: action.payload };
    case ActionType.SET_TYPE:
      return { ...state, type: action.payload };
    case ActionType.SET_STATUS:
      return { ...state, status: action.payload };
    case ActionType.SET_LINK:
      return { ...state, link: action.payload };
    default:
      return state;
  }
}

const defaultVal: States = {
  location: "",
  type: "archived",
  status: "idle",
  range: {
    start: 0,
    end: 0,
  },
  link: "https://www.konkurs.ro/concursuri-terminate"
};

const StoreContext = createContext<
  | {
      state: States;
      dispatch: React.Dispatch<Action>;
    }
  | undefined
>(undefined);

const Store = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, defaultVal);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
};
const useStore = () => {
  const c = useContext(StoreContext);
  if (c === undefined) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return c;
};

export { StoreContext, Store, ActionType, useStore };
