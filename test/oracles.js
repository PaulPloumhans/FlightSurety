const assert = require('assert');
var Test = require('../config/testConfig.js');
const BN = require('bn.js');

contract('Oracles', async (accounts) => {

  const TEST_ORACLES_COUNT = 20;
  const IDX_FIRST_ORACLE = 10;
  // Watch contract events
  const STATUS_CODE_UNKNOWN = 0;
  const STATUS_CODE_ON_TIME = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;
  const STATUS_CODE_LATE_WEATHER = 30;
  const STATUS_CODE_LATE_TECHNICAL = 40;
  const STATUS_CODE_LATE_OTHER = 50;
  // premium paid by a passenger for insurance - global varialbe since reused in different tests
  const premium = 1; // in ether
  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });


  it('can register oracles', async () => {
    
    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
    for(let a=0; a<TEST_ORACLES_COUNT; a++) {
      await config.flightSuretyApp.registerOracle({ from: accounts[IDX_FIRST_ORACLE+a], value: fee });
      let result = await config.flightSuretyApp.getMyIndexes.call({from: accounts[IDX_FIRST_ORACLE+a]});
      console.log(`Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`);
    }
  });

  it('can request flight status', async () => {
    
    // ARRANGE
    let flight = 'ND1309'; // Course number
    let timestamp = Math.floor(Date.now() / 1000);

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp);
    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for(let a=0; a<TEST_ORACLES_COUNT; a++) {

      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[IDX_FIRST_ORACLE+a]});
      for(let idx=0;idx<3;idx++) {

        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, STATUS_CODE_ON_TIME, { from: accounts[IDX_FIRST_ORACLE+a] });

        }
        catch(e) {
          // Enable this when debugging
          //console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
          //console.log(e.reason);
        }

      }
    }

  });

  it('If flight is delayed due to airline fault, passenger receives credit of 1.5X the amount they paid', async () => {
    
    // ARRANGE
    let flight = 'ND1309'; // Course number
    let timestamp = Math.floor(Date.now() / 1000);
    let firstAirline = config.firstAirline;
    let passenger = accounts[7];
    

     // check that first airline is registered but not funded
     let isFirstAirlineRegistered = await config.flightSuretyApp.isRegisteredAirline.call(firstAirline);
     assert.equal(isFirstAirlineRegistered, true, 'First airline should be registered');
     let isFirstAirlineFunded = await config.flightSuretyApp.isFundedAirline.call(firstAirline);
     assert.equal(isFirstAirlineFunded, false, 'First airline should not be funded');

     // fund firstAirline
     await config.flightSuretyApp.fund({from:firstAirline, value: (10*config.weiMultiple)});
     isFirstAirlineFunded = await config.flightSuretyApp.isFundedAirline.call(firstAirline);
     assert.equal(isFirstAirlineFunded, true, 'First airline should be funded');

    // passenger buys insurance for 1 ether
    await config.flightSuretyApp.buy(firstAirline, flight, timestamp, {from: passenger, value: (premium*config.weiMultiple)});
    let verifiedAmount = await config.flightSuretyApp.getInsurance(firstAirline, flight, timestamp, {from: passenger});
    assert.equal(verifiedAmount, premium*config.weiMultiple, 'Passenger could not pay insurance');

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp);


    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    // The oracle will this time sya that the airline is delayed due to the airline's fault
    for(let a=0; a<TEST_ORACLES_COUNT; a++) {

      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[IDX_FIRST_ORACLE+a]});
      for(let idx=0;idx<3;idx++) {

        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, STATUS_CODE_LATE_AIRLINE, { from: accounts[IDX_FIRST_ORACLE+a] });

        }
        catch(e) {
          // Enable this when debugging
          //console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
          //console.log(e.reason);
        }

      }
    }

    // ASSERT
    let actualCredit =  web3.utils.toBN(await config.flightSuretyApp.getCredit({from:passenger}));
    const expectedCredit = (web3.utils.toBN(premium*config.weiMultiple)).mul(new BN(3)).div(new BN(2));
    const ok = actualCredit.eq(expectedCredit);
    assert.equal(ok, true, `Credit to passenger is ${actualCredit.toString()} instead of ${expectedCredit.toString()}.`);

  });

  it('Passenger can withdraw any funds owed to them as a result of receiving credit for insurance payout', async () => {
    
    // ARRANGE
    let passenger = accounts[7];    

    // check the credit that is available for a passenger
    let credit = web3.utils.toBN(await config.flightSuretyApp.getCredit({from:passenger})); 
    //console.log('credit.toString() = ', credit.toString());
    //assert.equal(credit.gt(new BN(0)), true, `Credit for passenger ${passenger} should be positive`);
    
    // get the balance of the passenger
    let balanceBefore =  web3.utils.toBN( await web3.eth.getBalance(passenger) );
    //console.log('balanceBefore.toString() = ', balanceBefore.toString());
    
    
    // ACT - passenger recovers his money
    // let gasCost = await config.flightSuretyApp.pay.estimateGas({from:passenger});
    // console.log('Estimated gas cost = ', gasCost);
    let tx = await config.flightSuretyApp.pay({from:passenger});
    //console.log('tx = ', tx);
    let gasUsed = tx.receipt.gasUsed; // in gas multiple
    //console.log('gasUsed = ', gasUsed);
    let gasPrice = web3.utils.toBN(await web3.eth.getGasPrice()); // in wei
    //console.log('gasPrice = ', gasPrice);
    //console.log('gasPrice.toString() = ', gasPrice.toString());
    let gasCost = gasPrice.mul(new BN(gasUsed)); // in Wei
    //console.log('gasCost.toString() = ', gasCost.toString());
    let expectedBalanceAfter = balanceBefore.add(credit).sub(gasCost);
    //console.log('expectedBalanceAfter.toString() = ', expectedBalanceAfter.toString());

    // ASSERT
    let balanceAfter = web3.utils.toBN(await web3.eth.getBalance(passenger));
    //console.log('balanceAfter.toString() = ', balanceAfter.toString());
    let ok = balanceAfter.eq(expectedBalanceAfter);
    assert.equal(ok, true ,
      `Balance of passenger account after (${balanceAfter.toString()}) should be `
      +` == balance before + transaction gas cost (${expectedBalanceAfter.toString()}).`);
  });

  


 
});
