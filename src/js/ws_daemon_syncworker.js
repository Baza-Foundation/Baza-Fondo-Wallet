const log = require("electron-log");
const WalletShellDaemonApi = require("./ws_daemon_api");
const daemonSyncStatus = require("./ws_constants").daemonSyncStatus;

let DEBUG = false;
log.transports.file.maxSize = 5 * 1024 * 1024;
log.transports.console.level = "debug";
log.transports.file.level = "debug";

const SYNC_INTERVAL = 4 * 1000;
const SYNC_FAILED_MAX = 24;

let workerStatus = {
    CONNECTED: true,
    PAUSED: false,
    FAILED_COUNT: 0,
    SAVE_TICK: 0,
};
let daemonStatus = {
    LAST_NETWORK_BLOCK_COUNT: 0,
    LAST_LOCAL_DAEMON_BLOCK_COUNT: 0,
};
let walletShellDaemonApi = null;
let taskWorker = null;

function logDebug(msg) {
    if (!DEBUG) return;
    log.debug(`[daemon_syncworker] ${msg}`);
}

function initApi(cfg) {
    if (walletShellDaemonApi instanceof WalletShellDaemonApi) return;
    logDebug("Initializing WalletShellDaemonApi");
    walletShellDaemonApi = new WalletShellDaemonApi(cfg);
}

function checkBlockHeight() {
    if (walletShellDaemonApi === null) return;
    logDebug("-> blockUpdater: fetching block update");
    walletShellDaemonApi
        .getHeight()
        .then((blockHeight) => {
            let lastConnStatus = workerStatus.CONNECTED;
            let connFailed = parseInt(blockHeight.height, 10) === 1;
            if (connFailed) {
                logDebug(
                    "-> blockUpdater: Got bad known block count, mark connection as broken"
                );
                if (lastConnStatus !== connFailed) {
                    process.send({
                        type: "daemonBlockUpdated",
                        data: {
                            localDaemonBlockCount: daemonSyncStatus.NODE_ERROR,
                            networkBlockCount: daemonSyncStatus.NODE_ERROR,
                            displayLocalDaemonBlockCount:
                                daemonSyncStatus.NODE_ERROR,
                            displayNetworkBlockCount:
                                daemonSyncStatus.NODE_ERROR,
                            daemonSyncPercent: daemonSyncStatus.NODE_ERROR,
                        },
                    });
                }
                workerStatus.CONNECTED = false;
                return;
            }

            // we have good connection
            workerStatus.CONNECTED = true;
            workerStatus.FAILED_COUNT = 0;
            const localDaemonBlockCount = parseInt(blockHeight.height, 10);
            const networkBlockCount = parseInt(blockHeight.network_height, 10);

            if (
                !(
                    localDaemonBlockCount >
                    daemonStatus.LAST_LOCAL_DAEMON_BLOCK_COUNT
                ) &&
                !(networkBlockCount > daemonStatus.LAST_NETWORK_BLOCK_COUNT)
            ) {
                logDebug(`-> blockUpdater: no update, skip block notifier`);
                return;
            }

            logDebug("-> blockUpdater: block updated, notify block update");
            daemonStatus.LAST_LOCAL_DAEMON_BLOCK_COUNT = localDaemonBlockCount;
            daemonStatus.LAST_NETWORK_BLOCK_COUNT = networkBlockCount;

            // add any extras here, so renderer not doing too much things
            const displayNetworkBlockCount = networkBlockCount - 1;
            const displayLocalDaemonBlockCount =
                localDaemonBlockCount > displayNetworkBlockCount
                    ? displayNetworkBlockCount
                    : localDaemonBlockCount;
            let daemonSyncPercent =
                (displayLocalDaemonBlockCount / displayNetworkBlockCount) * 100;
            if (daemonSyncPercent <= 0 || daemonSyncPercent >= 99.995) {
                daemonSyncPercent = 100;
            } else {
                daemonSyncPercent = daemonSyncPercent.toFixed(2);
            }
            process.send({
                type: "daemonBlockUpdated",
                data: {
                    localDaemonBlockCount: localDaemonBlockCount,
                    networkBlockCount: networkBlockCount,
                    displayLocalDaemonBlockCount: displayLocalDaemonBlockCount,
                    displayNetworkBlockCount: displayNetworkBlockCount,
                    daemonSyncPercent: daemonSyncPercent,
                },
            });
        })
        .catch((err) => {
            workerStatus.FAILED_COUNT++;
            logDebug(
                `-> blockUpdater: FAILED, ${err.message} | failed count: ${workerStatus.FAILED_COUNT}`
            );
            if (workerStatus.FAILED_COUNT > SYNC_FAILED_MAX) {
                logDebug(
                    "-> blockUpdater: too many timeout, mark connection as broken"
                );
                process.send({
                    type: "daemonBlockUpdated",
                    data: {
                        localDaemonBlockCount: daemonSyncStatus.NODE_ERROR,
                        networkBlockCount: daemonSyncStatus.NODE_ERROR,
                        displayLocalDaemonBlockCount:
                            daemonSyncStatus.NODE_ERROR,
                        displayNetworkBlockCount: daemonSyncStatus.NODE_ERROR,
                        daemonSyncPercent: daemonSyncStatus.NODE_ERROR,
                    },
                });
                workerStatus.STATE_CONNECTED = false;
                return;
            }
            return false;
        });
}

function syncDaemon() {
    taskWorker = setInterval(() => {
        if (workerStatus.PAUSED) return;
        logDebug(`Daemon sync task...`);
        checkBlockHeight();
    }, SYNC_INTERVAL);
}

process.on("message", (msg) => {
    const cmd = msg || {};
    cmd.type = msg.type || "init";
    cmd.data = msg.data || null;

    switch (cmd.type) {
        case "init":
            initApi(cmd.data);
            process.send({
                type: "daemonSyncWorkerStatus",
                data: "OK",
            });
            if (cmd.debug) {
                DEBUG = true;
                logDebug("Running in debug mode.");
            }
            break;
        case "start":
            try {
                clearInterval(taskWorker);
            } catch (err) {}

            syncDaemon();
            break;
        case "pause":
            if (workerStatus.PAUSED) return;
            logDebug("Got suspend command");
            process.send({
                type: "daemonBlockUpdated",
                data: {
                    blockCount: daemonSyncStatus.NET_OFFLINE,
                    knownBlockCount: daemonSyncStatus.NET_OFFLINE,
                    displayBlockCount: daemonSyncStatus.NET_OFFLINE,
                    displayKnownBlockCount: daemonSyncStatus.NET_OFFLINE,
                    daemonSyncPercent: daemonSyncStatus.NET_OFFLINE,
                },
            });
            workerStatus.PAUSED = true;
            break;
        case "resume":
            logDebug("Got resume command");
            walletShellDaemonApi = null;
            initApi(cmd.data);
            setTimeout(() => {
                walletShellDaemonApi
                    .getHeight()
                    .then((blockHeight) => {
                        if (blockHeight.status == "OK") {
                            logDebug(`Warming up: getHeight OK`);
                            return;
                        }
                        logDebug(`Warming up: getHeight failed`);
                    })
                    .catch((err) => {
                        logDebug(
                            `Warming up: getHeight failed, ${err.message}`
                        );
                    });
                workerStatus.PAUSED = false;
            }, 15000);
            process.send({
                type: "daemonBlockUpdated",
                data: {
                    blockCount: daemonSyncStatus.NET_ONLINE,
                    knownBlockCount: daemonSyncStatus.NET_ONLINE,
                    displayBlockCount: daemonSyncStatus.NET_ONLINE,
                    displayKnownBlockCount: daemonSyncStatus.NET_ONLINE,
                    daemonSyncPercent: daemonSyncStatus.NET_ONLINE,
                },
            });
            break;
        case "stop":
            logDebug("Got stop command, halting all tasks and exit...");
            walletShellDaemonApi = null;
            try {
                clearInterval(taskWorker);
                process.exit(0);
            } catch (e) {
                logDebug(`FAILED, ${e.message}`);
                process.exit(1);
            }
            break;
        default:
            break;
    }
});

process.on("uncaughtException", function (err) {
    logDebug(`worker uncaughtException: ${err.message}`);
    process.exit(1);
});

process.on(
    "disconnect",
    () =>
        function () {
            logDebug(`worker disconnected`);
            process.exit(1);
        }
);
