import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';
import './flightsurety.css';

// Dapp html page IDs
var htm = {
    currentUser : document.getElementById('currentUser'),
    airlines : {
        namesMenu : document.getElementById('airlinesNamesMenu'),
        btnStatus : document.getElementById('btnAirlineStatusRefresh'),
        tableStatus : document.getElementById('tableAirlinesStatus'),
        addressToRegister : document.getElementById('airlineAddressToRegister'),
        btnRegister : document.getElementById('btnAirlineRegister'),
        amountToFund : document.getElementById('airlineAmountToFund'),
        btnFund : document.getElementById('btnAirlineFund'),    
        btnAssign : document.getElementById('btnAirlineAssignName')
    },
    insurance : {
        airlinesMenu: document.getElementById('insuranceAirlinesMenu'),    
        flightsMenu: document.getElementById('insuranceFlightsMenu'),
        amount: document.getElementById('insuranceAmount'),
        btnBuy: document.getElementById('btnInsuranceBuy'),
        purchaseMenu: document.getElementById('insurancePurchasedMenu'),
        btnCheckFlightStatus: document.getElementById('insuranceCheckFlightStatus'),
        btnUserCredit: document.getElementById('btnUserCredit'),
        creditAmount: document.getElementById('creditAmount'),
        btnWithdraw : document.getElementById('btnWithdraw'),
        flightStatus : document.getElementById('flightStatus'),
        spinnerStatus : document.getElementById('spinnerStatus'),
    },
    admin : {
        btnCheckStatus: document.getElementById('btnCheckStatus'),
        flightSuretyAppStatus: document.getElementById('flightSuretyAppStatus'),
    }
};
htm.insurance.spinnerStatus.style.display = 'none';

// Dapp
let flightSuretyApp = null;
let flightSuretyData = null;

// DB matchin airline addresses with names - to be fetched from server
let airlinesIDs = new Map(); // key = eth address, value = iata
let airlinesDB;
let airlinesDBMap = new Map(); // key = iata, value = name
let fundedAirlines = []; // array of adresses of funded airlines
let flightsDB;

let web3;


// server
const serverURL = 'http://localhost:3000';

// current account (from Metamask) need to make sure that this is a CheckSum address
let currentAccount; 

const isMetaMaskInstalled = () => {
    const { ethereum } = window
    return Boolean(ethereum && ethereum.isMetaMask)
}

const initialize = async(network) => {

    console.log('INITIALIZING');
    // ***********************************************************************************
    // ************            SETUP METAMASK AND GET USER ACCOUNT            ************
    // ***********************************************************************************

    web3 = new Web3(ethereum);
    
    //web3 = new Web3(new Web3.providers.WebsocketProvider(ethereum));

    // check that metamask is installed
    if(!isMetaMaskInstalled())
        window.alert('Metamask is not installed. Please install Metamask to use this site');
    
    // silence warnings
    ethereum.autoRefreshOnNetworkChange = false;
    // get accounts (should be an array of length 1, with accounts[0] the current account)
    let accounts;
    try {
        accounts = await ethereum.request({
            method: 'eth_requestAccounts',
        });
        currentAccount = web3.utils.toChecksumAddress(accounts[0]);
        htm.currentUser.innerHTML = 'Current user: ' + currentAccount;
    } catch (error) {
        console.error(error)
    }
        
    // handle event that informs of account change
    ethereum.on('accountsChanged', (acc) => {
        currentAccount = web3.utils.toChecksumAddress(acc[0]);
        htm.currentUser.innerHTML = 'Current user: ' + currentAccount;
        if( FlightSuretyApp !== null ){
            refreshPurchasedInsurances();
        }            
    });

    // ***********************************************************************************
    // ************           DEPLOY FLIGHTSURETYAPP SMART CONTRACT           ************
    // ***********************************************************************************

    let config = Config[network];
    flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
    flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
    flightSuretyData.methods.authorizeCaller(config.appAddress).send({from : currentAccount}).catch( (err) => {
        console.log(`Error when trying to authorize flightSuretyApp at address ${config.appAddress} to call flightSuretyData: `, err);
    });
    
    // ***********************************************************************************
    // ************                  MANAGEMENT OF AIRLINES                   ************
    // ***********************************************************************************

    // load flights and airlines - initialize global variables
    airlinesDB = await serverGetJSON('airlinesDB');
    for (let entry of airlinesDB){
        airlinesDBMap.set(entry.iata, entry.name);
    }    
    flightsDB = await serverGetJSON('flightsDB');

    // ************               ASSIGNMENT OF NAMES TO AIRLINES             ************

    // update menu
    let airlinesNamesMenu = '';
    for (let entry of airlinesDB){
        airlinesNamesMenu += '<option>' + entry.name + ' (' + entry.iata + ') </option>';
    }
    htm.airlines.namesMenu.innerHTML = airlinesNamesMenu;
 
    // load airlinesIDs from server and refresh status
    airlinesIDs = await serverGetMapJSON('airlinesIDs');
    refreshAirlinesStatus();

    // htm.airlines.btnAssign
    htm.airlines.btnAssign.onclick = async () => { 
        const idx = htm.airlines.namesMenu.selectedIndex;
        const assignData = {
            address : currentAccount,
            iata    : airlinesDB[idx].iata 
        };
        // sending info to server
        await serverPostJSON('assign', assignData);
        // get new airlinesIDs
        airlinesIDs = await serverGetMapJSON('airlinesIDs');
        refreshAirlinesStatus();
    };

    // htm.airlines.btnStatus - button for airline status refresh
    htm.airlines.btnStatus.onclick = refreshAirlinesStatus;

    // button for airline register
    htm.airlines.btnRegister.onclick = () => {
        const newAirline = htm.airlines.addressToRegister.value;
        flightSuretyApp.methods.registerAirline(newAirline).send({from : currentAccount}).then( () => {
            refreshAirlinesStatus();
        }).catch( err => {
            console.log('error caught in promise: ', err.message);
            window.alert('Could not register airline '+ currentAccount);
        });         
    }

    // button for airline funding
    htm.airlines.btnFund.onclick = () => {
        const funding = parseInt(htm.airlines.amountToFund.value);
        flightSuretyApp.methods.fund().send({from : currentAccount, value : web3.utils.toWei(htm.airlines.amountToFund.value, 'ether')}).then( () =>{
            refreshAirlinesStatus();
        }).catch( err => {
            console.log('error caught in promise: ', err.message);            
        });     
    }

    // ***********************************************************************************
    // ************                        INSURANCES                         ************
    // ***********************************************************************************

    // ************                     PURCHASE INSURANCE                    ************
    
    refreshPurchasedInsurances();

    // when clicking on menu to select airline, update list of funded insurances
    htm.insurance.airlinesMenu.onchange = () => {
        refreshInsuranceFlightsMenu();
    }

    // purchase insurance
    htm.insurance.btnBuy.onclick = () => {
        // recover insurance amount
        const amount = htm.insurance.amount.value;
        const selectedAirline = htm.insurance.airlinesMenu.value; // address of selected airline
        const selectedFlightTag = htm.insurance.flightsMenu.value; // selected flight code
        const posSeparator = selectedFlightTag.indexOf("*");
        if (posSeparator===-1)
            return;
        const selectedFlight = selectedFlightTag.substring(0,posSeparator);
        const selectedTimestamp = selectedFlightTag.substring(posSeparator+1, selectedFlightTag.length);
        
        flightSuretyApp.methods.buy(selectedAirline, selectedFlight, selectedTimestamp)
            .send({from : currentAccount, value : web3.utils.toWei(amount, 'ether')}).then( () =>{            
            refreshPurchasedInsurances();
        }).catch( err => {
            console.log('error caught in promise: ', err.message);
            window.alert('Could not purchase insurance');
        });    
    }

    // check flight status
    htm.insurance.btnCheckFlightStatus.onclick = () => {
        // get airline, flight and timestamp
        const selectedTag = htm.insurance.purchaseMenu.value;
        if(selectedTag===""){
            alert('No active insurance to check');
        }else{
            // empty status value
            htm.insurance.flightStatus.value = '';
            // show spinner
            htm.insurance.spinnerStatus.style.display = '';
            const posFirstSeparator = selectedTag.indexOf("*");
            const airline = selectedTag.substring(0,posFirstSeparator);
            const posSecondSeparator = selectedTag.indexOf("*", posFirstSeparator+1);
            const flight = selectedTag.substring(posFirstSeparator+1, posSecondSeparator);
            const timestamp = selectedTag.substring(posSecondSeparator+1,selectedTag.length);
            // call oracles
            flightSuretyApp.methods.fetchFlightStatus(airline,flight,web3.utils.toBN(timestamp)).send({from : currentAccount}).then( (res,err) => {            
                // console.log('->called oracles');            
            }).catch( err => {
                console.log('Error when calling oracle:', err);
            }).then( (res,err) => {
                // reflect the fact that one insurance might not be active anymore
                refreshPurchasedInsurances();            
            }).catch( err => {
                console.log('Error when refereshing list of purchased insurnces:', err);
            });
        }        
    }

    // capture event 
    console.log('Set code for FlightStatusInfo capture');
    htm.insurance.flightStatus.value = '';
    flightSuretyApp.events.FlightStatusInfo({fromBlock: 'latest'}, (error, event) => {
        if (error){
            console.log(error);
        }else{
            // show spinner
            htm.insurance.spinnerStatus.style.display = 'none';
            console.log('Event FlightStatusInfo captured');
            const rv = event.returnValues;
            const status = parseInt(rv.status);
            const statusName = flightStatus(status);
            htm.insurance.flightStatus.value = statusName + '  ( ' + rv.airline + ' - ' + rv.flight + ' - ' +
                rv.timestamp.substring(0,4) + '-' + rv.timestamp.substring(5,6) + rv.timestamp.substring(7,8) + ' )';
            refreshPurchasedInsurances();
        }
    });

    console.log('Set code for OracleRequest capture');
    flightSuretyApp.events.OracleRequest({fromBlock: 'latest'}, (error, event) => {
        if (error){
            console.log(error);
        }else{
            console.log('Event OracleRequest captured');
            const rv = event.returnValues;
            const index = parseInt(rv.index);          
        }
    });

    htm.insurance.creditAmount.value = '';
    htm.insurance.btnUserCredit.onclick = () => {
        displayUserCredit();
    };  
    
    htm.insurance.btnWithdraw.onclick = () => {
        flightSuretyApp.methods.pay().send({from : currentAccount}).then( (res,err) => {
            displayUserCredit();
        }).catch( err => {
            console.log(`Error when calling pay for user ${currentAccount}: `, err);
        });
    }    
    
    // ***********************************************************************************
    // ************                          ADMIN                            ************
    // ***********************************************************************************

    flightSuretyApp.methods.isOperational().call().then( (res,err) => {
        htm.admin.flightSuretyAppStatus.value = res; 
    });

    htm.admin.btnCheckStatus.onclick = () => {
        flightSuretyApp.methods.isOperational().call().then( (res,err) => {
            htm.admin.flightSuretyAppStatus.value = res;
        });
    };
}

// returns airline status code as a string based the (string) status code returned by the smart contract
function airlineStatus(statusCode){
    //console.log('statusCode = ', statusCode);
    //console.log('typeof(statusCode) = ', typeof(statusCode));
    switch(parseInt(statusCode)) {
        case 0:
            return 'UNREGISTERED';
            break;
        case 10:
            return 'IN_REGISTRATION';
            break;
        case 20:
            return 'REGISTERED';
            break;
        case 30:
            return 'FUNDED';
            break;
        default:
            error('Invalid status code ' + statusCode);
            return '';
    }
}

// returns flight status code as a string based the (string) status code returned by the smart contract
function flightStatus(statusCode){
    //console.log('statusCode = ', statusCode);
    //console.log('typeof(statusCode) = ', typeof(statusCode));
    
    switch(parseInt(statusCode)) {
        case 0:
            return 'UNKNOWN';
            break;
        case 10:
            return 'ON_TIME';
            break;
        case 20:
            return 'LATE_AIRLINE';
            break;
        case 30:
            return 'LATE_WEATHER';
            break;
        case 40:
            return 'LATE_TECHNICAL';
            break;
        case 50:
            return 'LATE_OTHER';
            break;
        default:
            error('Invalid status code ' + statusCode);
            return '';
    }
}

function refreshAirlinesStatus(){ 
    let tableRow='';               
    flightSuretyApp.methods.getAirlines().call().then( (res,err) => {
        if(!err){
            const airlines = res;
            let promiseVec = [];
            for (let entry of airlines) // loop on airlines
                promiseVec.push(flightSuretyApp.methods.getAirlineStatus(entry).call());
            Promise.all(promiseVec).then(status => {
                if(status.length !== airlines.length)
                    error('status.length !== airlines.length');
                // re-initialize list of funded airlines
                fundedAirlines = [];
                for (let i=0; i < status.length; i++){
                    let entryName = '';
                    let entryIata = '';
                    if (airlinesIDs.has(airlines[i])) {
                        entryIata = airlinesIDs.get(airlines[i]);
                        entryName = airlinesDBMap.get(entryIata);
                    }
                    tableRow += '<tr><td>' + airlines[i] + '</td><td>' + entryName + '</td><td>' + entryIata  + '</td><td>' + airlineStatus(status[i]) + '</td></tr>'; 
                    // if this is a funded airlines, push its address
                    if (status[i] === '30')
                        fundedAirlines.push(airlines[i]);
                }
                htm.airlines.tableStatus.innerHTML = tableRow;
                refreshInsuranceAirlinesMenu();
            });                                
        }else{
            console.log('error : ', err);
        }
    });   
};

function refreshInsuranceFlightsMenu() {
    let flightsMenu = '';
    const selectedAirline = htm.insurance.airlinesMenu.value; // address of selected airline        
    
    if(airlinesIDs.has(selectedAirline)){
        const selectedIata = airlinesIDs.get(selectedAirline); // IATA of selected airline
        // build menu items and create list of eligible flights
        for(let entry of flightsDB){ // loop on all flights in DB
            if( selectedIata.localeCompare(entry.airline.iata) === 0 ){ // match
                const departureTime = entry.departure.scheduled.substring(0,10) + ' ' + entry.departure.scheduled.substring(11,16);
                const arrivalTime = entry.arrival.scheduled.substring(0,10) + ' ' + entry.arrival.scheduled.substring(11,16);
                const flightCode = entry.airline.iata + entry.flight.number;
                const timestamp = (10000*parseInt(entry.departure.scheduled.substring(0,4))
                    +100*parseInt(entry.departure.scheduled.substring(5,7))
                    +parseInt(entry.departure.scheduled.substring(8,10))).toString();
                flightsMenu += '<option value = "' + flightCode + '*' + timestamp + '">'+ flightCode + '   ' +
                    entry.departure.iata + '(' + departureTime + ') -> ' + entry.arrival.iata + '(' + arrivalTime + ')' + '</option>';
            }
        }            
    }
    htm.insurance.flightsMenu.innerHTML = flightsMenu;
};

function refreshInsuranceAirlinesMenu() {
    let airlinesMenu = '';
    for (let entry of fundedAirlines){
        let iata='';
        let name='';
        if (airlinesIDs.has(entry)){
            iata = airlinesIDs.get(entry);
            name = airlinesDBMap.get(iata);
            airlinesMenu += '<option value="' + entry + '">' + entry + ' (' + name + ' / ' + iata + ') </option>';
        }else{
            airlinesMenu += '<option value="' + entry + '">' + entry + '</option>';
        }            
    }
    htm.insurance.airlinesMenu.innerHTML = airlinesMenu;
    refreshInsuranceFlightsMenu();
}

function refreshPurchasedInsurances(){ 
    let purchaseMenu='';       
    flightSuretyApp.methods.getActiveInsuranceKeys().call({from:currentAccount}).then( (res,err) => {
        if(!err){
            const keys = res.activeInsuranceKeys;
            const nKeys = res.nActiveInsurances;
            let promiseVec = [];
            for (let i=0; i<nKeys; i++) // loop on keys
                promiseVec.push(flightSuretyApp.methods.getInsuranceData(keys[i]).call());
            Promise.all(promiseVec).then(status => {
                if(status.length !== keys.length)
                    error('status.length !== keys.length');
                for (let i=0; i < status.length; i++){
                    const insuranceAddress = status[i].airline;
                    const insuranceFlight = status[i].flight;
                    const timestamp = status[i].timestamp.toString();
                    const tag = insuranceAddress + '*' + insuranceFlight + '*' + timestamp;
                    purchaseMenu += '<option value="' + tag + '">' + insuranceAddress + ' - ' + insuranceFlight + ' - ' + 
                        timestamp.substring(0,4) + '-' + timestamp.substring(4,6) + '-' + timestamp.substring(6,8) +'</option>';                    
                }
                htm.insurance.purchaseMenu.innerHTML = purchaseMenu;                
            });                                
        }else{
            console.log('error : ', err);
        }
    });   
};

function displayUserCredit() {
    flightSuretyApp.methods.getCredit().call({from:currentAccount}).then( (res,err) => {
        const amountETH = web3.utils.fromWei(res,'ether');
        htm.insurance.creditAmount.value = amountETH;        
    }).catch( err => {
        console.log(`Error when calling getCredit for user ${currentAccount}: `, err);
    });
};

// get 'dataName' from the server
async function serverGetJSON(dataName) {
    const url = serverURL + '/' + dataName;
    
    const response = await fetch(url, { method: 'GET' });
    if(response.ok){
        const data = await response.json();
        //console.log('GET - Success. Response:', data);
        return data;
    }else{
        const message = `An error has occured in serverGetJSON(${dataName}): ${response.status}`;
        throw new Error(message);
    }
         
};

// post data to server, using route routeName
async function serverPostJSON(routeName, data) {
    const url = serverURL + '/' + routeName;
    const fetchOptions = {
        method: 'POST',
        headers:{ "Content-Type": "application/json" },
        body: JSON.stringify(data)
    };
    
    const response = await fetch(url, fetchOptions);
    if(response.ok){
        const tmp = await response.json();
        //console.log('POST - Success. Response:', response);
        return;
    }else{
        const message = `An error has occured in serverPostJSON(${routeName}, ${JSON.stringify(data)}): ${response.status}`;
        throw new Error(message);
    }         
};

// update airlinesIDs
async function serverGetMapJSON(dataName) {    
    const url = serverURL + '/' + dataName;
    
    const response = await fetch(url, { method: 'GET' });
    // receives a string to be converted back into a map
    if(response.ok){
        const data = await response.json();
        const dataMap = new Map(data);
        //console.log('GET - Success');
        return dataMap;
    }else{
        const message = `An error has occured in serverGetMapJSON(${dataName}): ${response.status}`;
        throw new Error(message);
    }
}

//window.addEventListener('DOMContentLoaded', initialize('localhost'));

initialize('localhost');



