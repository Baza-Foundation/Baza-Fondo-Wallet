// This module needs improvement
const path = require("path");
const childProcess = require("child_process");
const log = require("electron-log");
const Store = require("electron-store");
const find_process = require("find-process");
const { remote } = require("electron");

const uiupdater = require("./wsui_updater");
const WalletShellSession = require("./ws_session");

const settings = new Store({ name: "Settings" });
const sessConfig = {
    debug: remote.app.debug,
    walletConfig: remote.app.walletConfig,
};
const wsession = new WalletShellSession(sessConfig);

const DAEMON_LOG_DEBUG = wsession.get("debug");
const DAEMON_LOG_LEVEL_DEFAULT = 0;
const DAEMON_LOG_LEVEL_DEBUG = 5;
const DAEMON_LOG_LEVEL = DAEMON_LOG_DEBUG
    ? DAEMON_LOG_LEVEL_DEBUG
    : DAEMON_LOG_LEVEL_DEFAULT;

class WalletShellDaemonManager {
    constructor() {
        if (!(this instanceof WalletShellDaemonManager)) {
            return new WalletShellDaemonManager();
        }

        this.daemonPid = null;
        this.daemonBin = settings.get("daemon_bin");
        this.daemonProcess = null;
        this.syncWorkerProcess = null;
        this.syncWorkerPid = null;
    }

    _getPid(proc) {
        return new Promise((resolve, reject) => {
            find_process("name", proc, true)
                .then((list) => {
                    if (!list.length) {
                        reject(null);
                    } else {
                        const pid = list.filter((x) => x.name === proc)[0].pid;
                        if (pid) resolve(pid);
                        reject(null);
                    }
                })
                .catch(() => reject(null));
        });
    }

    _spawnDaemon() {
        try {
            const daemonArgs = [
                "--log-level",
                DAEMON_LOG_LEVEL,
                "--log-file",
                path.join(
                    remote.app.getPath("userData"),
                    `${path.basename(this.daemonBin)}.log`
                ),
            ];
            const daemonOptions = {};
            if (wsession.get("debug")) {
                daemonOptions.stdio = "ignore";
            }
            this.daemonProcess = childProcess.spawn(
                this.daemonBin,
                daemonArgs,
                daemonOptions
            );
            this.daemonPid = this.daemonProcess.pid;
            wsession.set("connectedNode", settings.get("node_address"));
            log.info("Started daemon process");
        } catch (e) {
            log.error("Failed to start daemon process");
        }
    }

    _stopSyncWorker() {
        return new Promise((resolve, reject) => {
            log.info("Stopping daemon sync worker");
            this._getPid(path.basename("./ws_syncworker.js"))
                .then((pid) => {
                    log.info(`Found daemon syncworker pid, ${pid}`);
                    process.kill(pid, "SIGKILL");
                    this.syncWorkerProcess = null;
                    this.syncWorkerPid = null;
                    resolve();
                })
                .catch(() => {
                    if (this.syncWorkerProcess !== null) {
                        try {
                            this.syncWorkerProcess.kill("SIGKILL");
                        } catch (e) {}
                        this.syncWorkerProcess = null;
                        this.syncWorkerPid = null;
                    }
                    resolve();
                });
        });
    }

    _startSyncWorker() {
        this._stopSyncWorker().then(() => {
            this.syncWorkerProcess = childProcess.fork(
                path.join(__dirname, "./ws_daemon_syncworker.js")
            );
            this.syncWorkerPid = this.syncWorkerProcess.pid;
            this.syncWorkerProcess.on("message", (msg) => {
                if (msg.type === "daemonSyncWorkerStatus") {
                    this.syncWorkerProcess.send({
                        type: "start",
                        data: {},
                    });
                } else {
                    this._notifyUpdateToUiUpdater(msg);
                }
            });

            this.syncWorkerProcess.on("close", function () {
                try {
                    this.syncWorkerProcess.kill("SIGKILL");
                } catch (e) {}
                this.syncWorkerProcess = null;
                this.syncWorkerPid = null;
                log.debug("daemon sync worker terminated.");
            });

            this.syncWorkerProcess.on("exit", function () {
                this.syncWorkerProcess = null;
                this.syncWorkerPid = null;
                log.debug("daemon sync worker exited.");
            });

            this.syncWorkerProcess.on("error", function (err) {
                try {
                    this.syncWorkerProcess.kill("SIGKILL");
                } catch (e) {}
                this.syncWorkerProcess = null;
                this.syncWorkerPid = null;
                log.debug(`daemon sync worker error: ${err.message}`);
            });

            this.syncWorkerProcess.send({
                type: "init",
                data: {
                    nodeAddress: settings.get("node_address"),
                },
                debug: DAEMON_LOG_DEBUG,
            });
        });
    }

    _notifyUpdateToUiUpdater(msg) {
        uiupdater.updateUiState(msg);
    }

    startDaemon() {
        this._getPid(path.basename(this.daemonBin))
            .then((pid) => {
                if (pid) {
                    this.daemonPid = pid;
                    log.info("Daemon is running, using this process");
                    wsession.set("connectedNode", settings.get("node_address"));
                    this._startSyncWorker();
                } else {
                    this._spawnDaemon();
                    this._startSyncWorker();
                }
            })
            .catch(() => {
                this._spawnDaemon();
                this._startSyncWorker();
            });
    }

    stopDaemon() {
        if (!this.daemonProcess) {
            try {
                process.kill(this.daemonPid, "SIGTERM");
                log.info("Killed daemon process");
            } catch (e) {
                log.error("Failed to kill daemon process");
            }
        } else {
            try {
                this.daemonProcess.kill("SIGTERM");
                log.info("Stopped daemon process");
            } catch (e) {
                log.error("Failed to stop daemon process");
            }
        }
        this.daemonProcess = null;
        this.daemonPid = null;
        this._stopSyncWorker();
    }
}

module.exports = WalletShellDaemonManager;
