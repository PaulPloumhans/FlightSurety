import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import AirDB from './airDB.json';
import Web3 from 'web3';
import express from 'express';
import 'regenerator-runtime/runtime';

const fs = require('fs');

let app; // express server to export
const N_ORACLES = 3; // number of oracles
const IDX_FIRST_ORACLE = 10; // index of first oracle in set of accounts

const initialize = async () => {


  // ***********************************************************************************
  // ************            SETUP FLIGHTSURETYAPP SMART CONTRACT           ************
  // ***********************************************************************************

    
  // configure web3
  let config = Config['localhost'];
  let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
  // recover all Ganache accounts
  let accounts = await web3.eth.getAccounts();
  console.log('accounts = ', accounts);
  // connect to deployed smart contract FlightSuretyApp
  let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
  // check that contract is operational
  flightSuretyApp.methods.isOperational().call().then( (res,err) =>{
    console.log('Contract is operational : ', res);
  }).catch( () => {
    console.error('Could no call contract method');
  });

  /* flightSuretyApp.methods.getAirlines().call().then( (res,err) =>{
    console.log('airlines = ', res);    
  }).catch( () => {
    console.error('Could no call getAirlines!');
  }); */

  // ***********************************************************************************
  // ************                 SETUP ORACLE EVENT CAPTURE                ************
  // ***********************************************************************************

  flightSuretyApp.events.OracleRequest({fromBlock: "latest"}, function (error, event) {
    if (error){
      console.log(error);
    }
    console.log('Captured event :' + event.event);
    console.log(`index/airline/flight/timestamp : ${event.index}/${event.airline}/${event.flight}/${event.timestamp}`);
  });

  // ***********************************************************************************
  // *************     REGISTER ORACLES AND PERSIST THEIR STATE IN MEMORY  *************
  // ***********************************************************************************

  let oracleIndexes = new Map(); // key is oracle address, value are the oracle indices
  const oracleFee = await flightSuretyApp.methods.REGISTRATION_FEE().call();
  console.log('oracleFee = ', oracleFee);
  // check that we have at least 30 accounts, where accounts 10-29 (zero-based) are for oracles
  if (accounts.length < IDX_FIRST_ORACLE+N_ORACLES){
    throw Error(`Not enough accounts (${accounts.length}). At least ${IDX_FIRST_ORACLE+N_ORACLES} are required.`);
  } else {
    // register all oracles
    for(let i = 0; i < N_ORACLES; i++){
      let idx = IDX_FIRST_ORACLE+i;
      // we could prevent this for oracles already registered (via a modifier in smart contract)
      console.log('registering oracle');
      await flightSuretyApp.methods.registerOracle().send({ from: accounts[idx], value : oracleFee, gas: 1000000 });
      //let gas = await flightSuretyApp.methods.registerOracle().estimateGas({ value: oracleFee, from: accounts[idx] });
      //console.log('gas estimate = ', gas);
      // recover indices, convert them to numbers and store them
      let indexes = await flightSuretyApp.methods.getMyIndexes().call({from: accounts[idx]});
      let indexesNum = [];
      for(let j=0; j < indexes.length; j++){
        indexesNum.push(Number(indexes[j]));
      }
      oracleIndexes.set(accounts[idx], indexesNum);
    }
    console.log('oracleIndexes = ', oracleIndexes);
  }

  


  // ACT
  /* for(let a=1; a<TEST_ORACLES_COUNT; a++) {      
    await config.flightSuretyApp.registerOracle({ from: accounts[a], value: fee });
    let result = await config.flightSuretyApp.getMyIndexes.call({from: accounts[a]});
    console.log(`Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`);
  } */


  // ***********************************************************************************
  // ************                  START UP EXPRESS SERVER                  ************
  // ***********************************************************************************

  // load airlines and flights DB

  // read airDB.json
  
  // load flights and airlines
  let airlinesDB = AirDB['airlinesDB'];
  let flightsDB = AirDB['flightsDB'];
  //console.log('airlinesDB = ', airlinesDB);
  //console.log('flightsDB = ', flightsDB);

  // start express server

  const app = express();
  const port = 3000;
  
  app.get('/', (req, res) => {
    res.send('Hello World!')
  })

  app.get('/airlinesDB', (req, res) => {
      res.send(JSON.stringify(airlinesDB));
  });

  app.get('/flightsDB', (req, res) => {
      res.send(JSON.stringify(flightsDB));
  });

  app.post('/assign', (req, res) => {
      let tmp = req.query;
      res.send(JSON.stringify(tmp));
  });
  
  app.listen(port, () => {
    console.log(`Example app now listening at http://localhost:${port}`)
  })

};

initialize().catch(err => {
  console.log('Error during initialize : ', err.message);
});

export default app;




