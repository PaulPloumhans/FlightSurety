//var HDWalletProvider = require("truffle-hdwallet-provider");
var HDWalletProvider = require("@truffle/hdwallet-provider");
var mnemonic = "cancel lens page pigeon neglect banana silver magnet lunar gap dumb awake";

module.exports = {
  networks: {
    development: {
        host: "127.0.0.1",       // Localhost (default: none)
        port: 7545,              // 8545 = ganache-cli, 7545 = ganache gui
        network_id: "*",         // Any network (default: none)
        websockets: true,        // Enable EventEmitter interface for web3 (default: false)
        //gas: 10000000            // round number, easier for debugging
      },  
    development_alt: {
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:7545/", 0, 50);
      },
      network_id: '*',
      gas: 9999999
    }
  },
  compilers: {
    solc: {
      version: "^0.6.2"
    }
  }
};
