// This module needs improvement
const path = require('path')
const childProcess = require('child_process')
const log = require('electron-log')
const Store = require('electron-store')
const find_process = require('find-process')
const { remote } = require('electron')

const WalletShellSession = require('./ws_session')

const settings = new Store({ name: 'Settings' })
const sessConfig = {
    debug: remote.app.debug,
    walletConfig: remote.app.walletConfig
}
const wsession = new WalletShellSession(sessConfig)

const DAEMON_LOG_DEBUG = wsession.get('debug')
const DAEMON_LOG_LEVEL_DEFAULT = 0
const DAEMON_LOG_LEVEL_DEBUG = 5
const DAEMON_LOG_LEVEL = DAEMON_LOG_DEBUG
    ? DAEMON_LOG_LEVEL_DEBUG
    : DAEMON_LOG_LEVEL_DEFAULT

class WalletShellDaemonManager {
    constructor() {
        if (!(this instanceof WalletShellDaemonManager)) {
            return new WalletShellDaemonManager()
        }

        this.daemonPid = null
        this.daemonBin = settings.get('daemon_bin')
        this.daemonProcess = null
    }

    _getPid() {
        return new Promise((resolve, reject) => {
            const proc = path.basename(this.daemonBin)
            find_process('name', proc, true)
                .then(list => {
                    if (!list.length) {
                        return resolve(null)
                    } else {
                        const pid = list.filter(x => x.name === proc)[0].pid
                        return resolve(pid)
                    }
                })
                .catch(() => reject(null))
        })
    }

    _spawnDaemon() {
        try {
            const daemonArgs = [
                '--log-level',
                DAEMON_LOG_LEVEL,
                '--log-file',
                path.join(
                    remote.app.getPath('userData'),
                    `${path.basename(this.daemonBin)}.log`
                )
            ]
            this.daemonProcess = childProcess.spawn(this.daemonBin, daemonArgs)
            this.daemonPid = this.daemonProcess.pid
            log.info('Started daemon process')
        } catch (e) {
            log.error('Failed to start daemon process')
        }
    }

    startDaemon() {
        this._getPid()
            .then(pid => {
                if (pid) {
                    this.daemonPid = pid
                    log.info('Daemon is running, using this process')
                } else {
                    this._spawnDaemon()
                }
            })
            .catch(() => {
                this._spawnDaemon()
            })
    }

    stopDaemon() {
        if (!this.daemonProcess) {
            try {
                process.kill(this.daemonPid, 'SIGTERM')
                log.info('Killed daemon process')
            } catch (e) {
                log.error('Failed to kill daemon process')
            }
        } else {
            try {
                this.daemonProcess.kill('SIGTERM')
                log.info('Stopped daemon process')
            } catch (e) {
                log.error('Failed to stop daemon process')
            }
        }
        this.daemonProcess = null
        this.daemonPid = null
    }
}

module.exports = WalletShellDaemonManager
