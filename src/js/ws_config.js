var config = {};

// self explanatory, your application name, descriptions, etc
config.appName = "bazafondowallet";
config.appDescription = "Baza Foundation GUI Wallet";
config.appSlogan = "Because everyone needs a basic foundation";
config.appId = "foundation.baza.bazafondowallet";
config.appGitRepo = "https://github.com/Baza-Foundation/Baza-Fondo-Wallet";

// default port number for your daemon (e.g. bazad)
config.daemonDefaultRpcPort = 11754;

// change this to match your daemon executable filename
config.daemonBinaryFilename = "bazad";

// version on the bundled daemon executable
config.daemonBinaryVersion = "v0.0.1.9";

// wallet file created by this app will have this extension
config.walletFileDefaultExt = "bwl";

// change this to match your wallet service executable filename
config.walletServiceBinaryFilename = "baza-service";

// version on the bundled service (turtle-service)
config.walletServiceBinaryVersion = "v0.0.1.9";

// config file format supported by wallet service, possible values:
// ini -->  for turtle service (or its forks) version <= v0.8.3
// json --> for turtle service (or its forks) version >= v0.8.4
config.walletServiceConfigFormat = "json";

// default port number for your wallet service (e.g. turtle-service)
config.walletServiceRpcPort = 8070;

// block explorer url, the [[TX_HASH]] will be substituted w/ actual transaction hash
config.blockExplorerUrl =
    "https://explorer.baza.foundation/?hash=[[TX_HASH]]#blockchain_transaction";

// default remote node to connect to, set this to a known reliable node for 'just works' user experience
config.remoteNodeDefaultHost = "";

// remote node list update url, set to null if you don't have one
// for TRTL:
// raw list: https://raw.githubusercontent.com/turtlecoin/turtlecoin-nodes-json/master/turtlecoin-nodes.json
// filtered: https://trtl.nodes.pub/api/getNodes
config.remoteNodeListUpdateUrl = null;

// set to false if using raw/unfiltered node list
config.remoteNodeListFiltered = true;

// fallback remote node list, in case fetching update failed, fill this with known to works remote nodes
config.remoteNodeListFallback = ["127.0.0.1:11754"];
config.remoteNodeCacheSupported = false;
config.remoteNodeSslSupported = false;

// your currency name
config.assetName = "Baza Token";
// your currency ticker
config.assetTicker = "BAZ";
// your currency address prefix, for address validation
config.addressPrefix = "baza";
// standard wallet address length, for address validation
config.addressLength = 99;
// integrated wallet address length, for address validation. Added length is length of payment ID encoded in base58.
config.integratedAddressLength = config.addressLength + (64 * 11) / 8;

// minimum fee for sending transaction
config.minimumFee = 0.001;
// minimum amount for sending transaction
config.mininumSend = 0.001;
// default mixin/anonimity for transaction
config.defaultMixin = 3;
// to represent human readable value
config.decimalPlaces = 6;
// to convert from atomic unit
config.decimalDivisor = 10 ** config.decimalPlaces;

// obfuscate address book entries, set to false if you want to save it in plain json file.
// not for security because the encryption key is attached here
config.addressBookObfuscateEntries = true;
// key use to obfuscate address book contents
config.addressBookObfuscationKey =
    "79009fb00ca1b7130832a42de45142cf6c4b7f333fe6fba5";
// initial/sample entries to fill new address book
config.addressBookSampleEntries = [];
// cipher config for private address book
config.addressBookCipherConfig = {
    algorithm: "aes-256-gcm",
    saltLenght: 128,
    pbkdf2Rounds: 10000,
    pbkdf2Digest: "sha512",
};

module.exports = config;
