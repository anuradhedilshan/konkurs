import LogTerminal from "./Logger_view";
import { ActionType, useStore } from "./store/app.store";

const h = "hello";
console.log(h);

const Start = () => {
  const { state, dispatch } = useStore();
  console.log("STart Button render");

  return (
    <div className="flex justify-end mt-3">
      <button
        className={`px-4 py-2 rounded-md 
        bg-blue-600 text-white
      }`}
        onClick={() => {
          console.log(state);

          if (state.status === "idle" && state.link) {
            if (!state.location) {
              window.MyApi.showFilePathError();
              return;
            }
            window.MyApi.start(
              state.type,
              state.location,
              state.range,
              state.link,
            );
            dispatch({ type: ActionType.SET_STATUS, payload: "running" });
          } else {
            if (window.MyApi.OnEvent)
              window.MyApi.OnEvent(
                "error",
                "The process is currently running or no link is provided.  ",
              );
            console.log("Already started or no link");
          }
        }}
      >
        Start
      </button>
    </div>
  );
};

const DataView = () => {
  return (
    <div>
      <div>
        <LogTerminal />
      </div>
      <Start />
    </div>
  );
};

export default DataView;
