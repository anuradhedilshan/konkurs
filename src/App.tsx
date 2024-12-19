import ControllerView from "./ControllerView";
import DataView from "./DataView";
import { Store } from "./store/app.store";

function App() {
  
  return (
    <>
      <Store>
        <div className=" flex flex-row gap-2">
          {/* Controller View */}
          <div className="w-5/12 rounded-lg h-[90vh] shadow-md m-1 p-2">
            <ControllerView />
          </div>
          {/* Data View */}
          <div className="w-6/12 rounded-lg h-[90vh]  shadow-md m-1 p-2">
            <DataView />
          </div>
        </div>
      </Store>
    </>
  );
}

export default App;
