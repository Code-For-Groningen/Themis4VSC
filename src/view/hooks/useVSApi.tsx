import { useContext } from "react";
import VSContext, { VSApi } from "../context/VSContext";

function useVSApi(): VSApi {
    return useContext(VSContext);
}

export default useVSApi;