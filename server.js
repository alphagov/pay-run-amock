import {coreHandlers} from "./lib/coreHandlers.js";
import {getConfiguredHandlersSharedState, isDebug, port} from "./lib/sharedState.js";
import {getCurrentTime} from "./lib/utils.js";
import {startHttpServer} from "./lib/httpServer.js";

//TODO: Add test for query string matching

startHttpServer()
