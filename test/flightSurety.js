var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');
const assert = require('assert');

contract('Flight Surety Tests', async (accounts) => {

    var config;
    before('setup contract', async () => {
        config = await Test.Config(accounts);
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
    });

    /****************************************************************************************/
    /* FlightSuretyData - Operations and Settings                                           */
    /****************************************************************************************/

    it(`FlightSuretyData - has correct initial isOperational() value`, async function () {
        // Get operating status
        let status = await config.flightSuretyData.isOperational.call();
        assert.equal(status, true, "Incorrect initial operating status value");
    });

    it(`FlightSuretyData - can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
        // Ensure that access is denied for non-Contract Owner account
        let accessDenied = false;
        try 
        {
            await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
        }
        catch(e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");        
    });

    it(`FlightSuretyData - can allow access to setOperatingStatus() for Contract Owner account`, async function () {
        // Ensure that access is allowed for Contract Owner account
        let accessDenied = false;
        try 
        {
            await config.flightSuretyData.setOperatingStatus(false);
        }
        catch(e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, false, "Access not allowed to Contract Owner");
        // Set it back for other tests to work
        await config.flightSuretyData.setOperatingStatus(true);  
    });

    it(`FlightSuretyData - can block access to functions using requireIsOperational when operating status is false`, async function () {

        await config.flightSuretyData.setOperatingStatus(false);

        let reverted = false;
        try 
        {
            await config.flightSuretyData.testIsOperational.call();
        }
        catch(e) {
            reverted = true;
        }
        assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

        // Set it back for other tests to work
        await config.flightSuretyData.setOperatingStatus(true);
    });

    it(`FlightSuretyData - can allow access to functions using requireIsOperational when operating status is true`, async function () {

        let reverted = false;
        try 
        {
            await config.flightSuretyData.testIsOperational.call();
        }
        catch(e) {
            reverted = true;
        }
        assert.equal(reverted, false, "Access not allowed event though operating status is true");      

    });

    /****************************************************************************************/
    /* FlightSuretyApp - Operations and Settings                                           */
    /****************************************************************************************/

    it(`FlightSuretyApp - has correct initial isOperational() value`, async function () {
        // Get operating status
        let status = await config.flightSuretyApp.isOperational.call();
        assert.equal(status, true, "Incorrect initial operating status value");
    });

    it(`FlightSuretyApp - can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
        // Ensure that access is denied for non-Contract Owner account
        let accessDenied = false;
        try 
        {
            await config.flightSuretyApp.setOperatingStatus(false, { from: config.testAddresses[2] });
        }
        catch(e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");        
    });

    it(`FlightSuretyApp - can allow access to setOperatingStatus() for Contract Owner account`, async function () {
        // Ensure that access is allowed for Contract Owner account
        let accessDenied = false;
        try 
        {
            await config.flightSuretyApp.setOperatingStatus(false);
        }
        catch(e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, false, "Access not allowed to Contract Owner");
        // Set it back for other tests to work
        await config.flightSuretyApp.setOperatingStatus(true);  
    });

    it(`FlightSuretyApp - can block access to functions using requireIsOperational when operating status is false`, async function () {

        await config.flightSuretyApp.setOperatingStatus(false);

        let reverted = false;
        try 
        {
            await config.flightSuretyApp.testIsOperational.call();
        }
        catch(e) {
            reverted = true;
        }
        assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

        // Set it back for other tests to work
        await config.flightSuretyApp.setOperatingStatus(true);
    });

    it(`FlightSuretyApp - can allow access to functions using requireIsOperational when operating status is true`, async function () {

        let reverted = false;
        try 
        {
            await config.flightSuretyApp.testIsOperational.call();
        }
        catch(e) {
            reverted = true;
        }
        assert.equal(reverted, false, "Access not allowed event though operating status is true");      

    });

    it('FlightSuretyApp - Airline Contract Initialization - first airline is registered when contract is deployed', async () => {
        // ARRANGE
        let firstAirline = accounts[1];
        assert.equal(firstAirline === config.firstAirline, true, "first airline should be accounts[1]");
        let result = false ; // initialize

        // ACT
        result = await config.flightSuretyApp.isRegisteredAirline.call(firstAirline);
        
        // ASSERT
        assert.equal(result, true, "First airline should be registerd when contract is deployed");
    });

    it('FlightSuretyApp - Airline Ante - a registered airline that is not funded cannot register another airlines', async () => {
        // ARRANGE
        let firstAirline = accounts[1];
        let secondAirline = accounts[2];
        let reverted = false;

        // check that first airline is regietered but not funded
        let isFirstAirlineRegistered = await config.flightSuretyApp.isRegisteredAirline.call(firstAirline);
        assert.equal(isFirstAirlineRegistered, true, 'First airline should be registered');
        let isFirstAirlineFunded = await config.flightSuretyApp.isFundedAirline.call(firstAirline);
        assert.equal(isFirstAirlineFunded, false, 'First airline should not be funded');

        // ACT
        try {
            await config.flightSuretyApp.registerAirline(secondAirline, {from:firstAirline});        
        }
        catch(e) {
            reverted = true;
        }
        
        // ASSERT
        assert.equal(reverted, true, "First airline is registered but not funded so should be not be able to register another airline");
    });

    it('FlightSuretyApp - Airline Ante - a registered airline that is funded can register another airline', async () => {
        // ARRANGE
        let firstAirline = accounts[1];
        let secondAirline = accounts[2];
        let reverted = false;

        // check that first airline is registered but not funded
        let isFirstAirlineRegistered = await config.flightSuretyApp.isRegisteredAirline.call(firstAirline);
        assert.equal(isFirstAirlineRegistered, true, 'First airline should be registered');
        let isFirstAirlineFunded = await config.flightSuretyApp.isFundedAirline.call(firstAirline);
        assert.equal(isFirstAirlineFunded, false, 'First airline should not be funded');

        // fund firstAirline
        await config.flightSuretyApp.fund({from:firstAirline, value: (10*config.weiMultiple)});
        isFirstAirlineFunded = await config.flightSuretyApp.isFundedAirline.call(firstAirline);
        assert.equal(isFirstAirlineFunded, true, 'First airline should be funded');

        // ACT
        try {
            await config.flightSuretyApp.registerAirline(secondAirline, {from:firstAirline});        
        }
        catch(e) {
            reverted = true;
        }
        
        // ASSERT
        assert.equal(reverted, false, "The first airline is registered and funded so should be able to register another airline");
    });

    it('FlightSuretyApp - Airline Ante - an airline not registerd cannot be funded', async () => {
        // ARRANGE
        let thirdAirline = accounts[3];
        let reverted = false;

        // check that first airline is registered but not funded
        let isThirdAirlineRegistered = await config.flightSuretyApp.isRegisteredAirline.call(thirdAirline);
        assert.equal(isThirdAirlineRegistered, false, 'Third airline should be registered');

        // ACT
        try {
            // attempt tu fund the third airline, which is not registered
            await config.flightSuretyApp.fund({from:thirdAirline, value: (10*config.weiMultiple)});
        }
        catch(e) {
            reverted = true;
        }
        
        // ASSERT
        assert.equal(reverted, true, "The third airline is not registered, therefore any attempt to fund it should be rejected");

    });
 
    it('FlightSuretyApp - Multiparty Consensus - up to the 4th airline, airlines that are funded (and registered) can register other airlines', async () => {
        // ARRANGE
        let firstAirline = accounts[1];
        let secondAirline = accounts[2];
        let thirdAirline = accounts[3];
        let fourthAirline = accounts[4];

        // check that first airline is funded and the second registered but not funded
        let isFirstAirlineFunded = await config.flightSuretyApp.isFundedAirline.call(firstAirline);
        assert.equal(isFirstAirlineFunded, true, 'First airline should be funded');
        let isSecondAirlineRegistered = await config.flightSuretyApp.isRegisteredAirline.call(secondAirline);
        assert.equal(isSecondAirlineRegistered, true, 'First airline should be registered');
        let isSecondAirlineFunded = await config.flightSuretyApp.isFundedAirline.call(secondAirline);
        assert.equal(isSecondAirlineFunded, false, 'Second airline should not be funded');

        // ACT 
        // fund secondAirline
        await config.flightSuretyApp.fund({from:secondAirline, value: (10*config.weiMultiple)});
        isSecondAirlineFunded = await config.flightSuretyApp.isFundedAirline.call(firstAirline);

        // register and then fund third airline
        await config.flightSuretyApp.registerAirline(thirdAirline, {from:secondAirline});
        let isThirdAirlineRegistered = await config.flightSuretyApp.isRegisteredAirline.call(thirdAirline);
        await config.flightSuretyApp.fund({from:thirdAirline, value: (10*config.weiMultiple)});
        let isThirdAirlineFunded = await config.flightSuretyApp.isFundedAirline.call(thirdAirline);

        // register and then fund fourth airline
        await config.flightSuretyApp.registerAirline(fourthAirline, {from:thirdAirline});
        let isFourthAirlineRegistered = await config.flightSuretyApp.isRegisteredAirline.call(fourthAirline);
        await config.flightSuretyApp.fund({from:fourthAirline, value: (10*config.weiMultiple)});
        let isFourthAirlineFunded = await config.flightSuretyApp.isFundedAirline.call(fourthAirline);
        
        // ASSERT
        assert.equal(isSecondAirlineFunded, true, "The second airline could not be funded");
        assert.equal(isThirdAirlineRegistered, true, "The third airline could not be registered");
        assert.equal(isThirdAirlineFunded, true, "The third airline could not be funded");
        assert.equal(isFourthAirlineRegistered, true, "The fourth airline could not be registered");
        assert.equal(isFourthAirlineFunded, true, "The fourth airline could not be funded");

    });
 
    it('FlightSuretyApp - Multiparty Consensus - for the 5th airline, a 50% consensus of 2 funded airlines is required to register a new airline', async () => {
        // ARRANGE
        // the ith airline is accounts[i]

        // first check that first 4 airlines are funded (hence can participate in voting process)
        for(i = 1; i <= 4; i++){
            let isAirlineFunded = await config.flightSuretyApp.isFundedAirline.call(accounts[i]);
            if( isAirlineFunded === false )
                break;
        }
        assert.equal(i, 5, 'Airline ' + i + ' is not funded');

        // ACT
        let fifthAirline = accounts[5];
        await config.flightSuretyApp.registerAirline(fifthAirline, {from:accounts[2]});
        let statusAfterFirst = await config.flightSuretyApp.isRegisteredAirline.call(fifthAirline);
        await config.flightSuretyApp.registerAirline(fifthAirline, {from:accounts[3]});
        let statusAfterSecond = await config.flightSuretyApp.isRegisteredAirline.call(fifthAirline);

        // ASSERT
        assert.equal(statusAfterFirst, false, "Fifth airline cannot be registered after one vote");
        assert.equal(statusAfterSecond, true, "Fifth airline should be registered after two votes");

    });

    it('FlightSuretyApp - Multiparty Consensus - for the 6th airline, a 50% consensus of 3 funded airlines is required to register a new airline', async () => {
        // ARRANGE
        // the ith airline is accounts[i]

        // first check that first 4 airlines are funded (hence can participate in voting process) - the fith is not funded yet
        for(i = 1; i <= 4; i++){
            let isAirlineFunded = await config.flightSuretyApp.isFundedAirline.call(accounts[i]);
            if( isAirlineFunded === false )
                break;
        }
        assert.equal(i, 5, 'Airline ' + i + ' is not funded');

        // ACT
        let sixthAirline = accounts[6];
        await config.flightSuretyApp.registerAirline(sixthAirline, {from:accounts[2]});
        let statusAfterFirst = await config.flightSuretyApp.isRegisteredAirline.call(sixthAirline);
        await config.flightSuretyApp.registerAirline(sixthAirline, {from:accounts[3]});
        let statusAfterSecond = await config.flightSuretyApp.isRegisteredAirline.call(sixthAirline);
        await config.flightSuretyApp.registerAirline(sixthAirline, {from:accounts[4]});
        let statusAfterThird = await config.flightSuretyApp.isRegisteredAirline.call(sixthAirline);

        // ASSERT
        assert.equal(statusAfterFirst, false, "Sixth airline cannot be registered after one vote");
        assert.equal(statusAfterSecond, false, "Sixth airline cannot be registered after two votes");
        assert.equal(statusAfterThird, true, "Sixth airline should be registered after three votes");

    });

});
