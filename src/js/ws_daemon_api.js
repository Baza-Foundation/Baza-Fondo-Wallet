const request = require("request-promise-native");

class WalletShellDaemonApi {
    constructor(args) {
        args = args || {};
        if (!(this instanceof WalletShellDaemonApi))
            return new WalletShellDaemonApi(args);
        const nodeAddress = args.nodeAddress.split(":");
        this.daemonHost = nodeAddress[0] || "127.0.0.1";
        this.daemonPort = nodeAddress[1] || "11754";
    }

    _sendJSONRPCRequest(method, params, timeout) {
        return new Promise((resolve, reject) => {
            if (method.length === 0) {
                reject(new Error("Invalid Method"));
            }
            params = params || {};
            timeout = timeout || 3000;
            let data = {
                jsonrpc: "2.0",
                method: method,
                params: params,
            };
            request({
                uri: `http://${this.daemonHost}:${this.daemonPort}/json_rpc`,
                method: "POST",
                headers: {
                    Connection: "keep-alive",
                },
                body: data,
                json: true,
                timeout: timeout,
            })
                .then((res) => {
                    if (!res) {
                        resolve(true);
                    }
                    if (!res.error) {
                        if (res.result) {
                            resolve(res.result);
                        }
                        resolve(res);
                    } else {
                        reject(res.error.message);
                    }
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    _sendHTTPRPCRequest(method, timeout) {
        return new Promise((resolve, reject) => {
            if (method.length === 0) {
                reject(new Error("Invalid Method"));
            }
            timeout = timeout || 3000;
            request({
                uri: `http://${this.daemonHost}:${this.daemonPort}/${method}`,
                method: "GET",
                json: true,
                timeout: timeout,
            })
                .then((res) => {
                    if (!res) {
                        resolve(true);
                    }
                    if (!res.error) {
                        if (res.result) {
                            resolve(res.result);
                        }
                        resolve(res);
                    } else {
                        reject(res.error.message);
                    }
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }

    getHeight() {
        return new Promise((resolve, reject) => {
            this._sendHTTPRPCRequest("getheight")
                .then((result) => {
                    resolve(result);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    }
}

module.exports = WalletShellDaemonApi;
