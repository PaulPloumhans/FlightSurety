import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import AirDB from './airDB.json';
import Web3 from 'web3';
import DOM from './dom';
//import Contract from './contract';
import './flightsurety.css';

// Dapp overall status info
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
    }
};

// Dapp
let flightSuretyApp;
let flightSuretyData;

// DB matchin airline addresses with names
let airlinesIDs = new Map(); // key = eth address, value = airlinesDB entry

// current account (from Metamask) need to make sure that this is a CheckSum address
let currentAccount; 

const htmAirlinesBtnAssign = document.getElementById('btnAirlineAssignName');

const isMetaMaskInstalled = () => {
    const { ethereum } = window
    return Boolean(ethereum && ethereum.isMetaMask)
}

const initialize = async(network) => {

    console.log('INITIALIZING');
    // ***********************************************************************************
    // ************            SETUP METAMASK AND GET USER ACCOUNT            ************
    // ***********************************************************************************

    let web3 = new Web3(ethereum);

    // check that metamask is installed
    if(!isMetaMaskInstalled())
        window.alert('Metamask is not installed. Please install Metamask to use this site');
    
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
    });

    // ***********************************************************************************
    // ************           DEPLOY FLIGHTSURETYAPP SMART CONTRACT           ************
    // ***********************************************************************************

    let config = Config[network];
    flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
    flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
    flightSuretyData.methods.authorizeCaller(config.appAddress).send({from : currentAccount}).catch( (err) => {
        console.log('Error when trying to authorize flightSuretyApp at address ${config.address} to call flightSuretyData: ', err);
    });
    
    // ***********************************************************************************
    // ************                  MANAGEMENT OF AIRLINES                   ************
    // ***********************************************************************************

    // load flights and airlines
    let airlinesDB = AirDB['airlinesDB'];
    let flightsDB = AirDB['flightsDB'];
    

    //console.log('airlinesDB = ', airlinesDB);

    // ************               ASSIGNMENT OF NAMES TO AIRLINES             ************

    // update menu
    let airlinesNamesMenu = '';
    for (let entry of airlinesDB){
        //console.log('entry  = ', entry);
        airlinesNamesMenu += '<option>' + entry.name + ' (' + entry.iata + ') </option>';
    }
    //console.log('airlinesNamesMenu = ', airlinesNamesMenu);
    htm.airlines.namesMenu.innerHTML = airlinesNamesMenu;
 
    // htm.airlines.btnAssign
    htmAirlinesBtnAssign.onclick = () => { 
        const idx = htm.airlines.namesMenu.selectedIndex;
        console.log('idx = ', idx);
        airlinesIDs.set(currentAccount, airlinesDB[idx]);
        console.log('airlinesIDs = ', airlinesIDs);
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
            window.alert('Could not register airlilne '+ currentAccount);
        });         
    }

    // button for airline funding
    htm.airlines.btnFund.onclick = () => {
        console.log('htm.airlines.amountToFund.value = ', htm.airlines.amountToFund.value);
        console.log('typeof(htm.airlines.amountToFund.value) = ', typeof(htm.airlines.amountToFund.value));
        const funding = parseInt(htm.airlines.amountToFund.value);
        console.log('typeof(funding) = ', typeof(funding));        
        flightSuretyApp.methods.fund().send({from : currentAccount, value : web3.utils.toWei(htm.airlines.amountToFund.value, 'ether')}).then( () =>{
            refreshAirlinesStatus();
        }).catch( err => {
            console.log('error caught in promise: ', err.message);
            window.alert('Could not fund airline '+ currentAccount);
        });     
    }

    // ************               ASSIGNMENT OF NAMES TO AIRLINES             ************

    // ***********************************************************************************
    // ************               REPAIR INITIAL CAPABILITIES                 ************
    // ***********************************************************************************

    /* flightSuretyApp.methods.isOperational().call().then( (res,err) => {
        console.log('res = ', res);
        display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: err, value: res} ]);
    });

    DOM.elid('submit-oracle').addEventListener('click', () => {
        let flight = DOM.elid('flight-number').value;
        // Write transaction
        let airline = accounts[0];
        //console.log('airline = ',airline);
        flightSuretyApp.methods.fetchFlightStatus(airline,flight,Math.floor(Date.now() / 1000)).call().then( (res,err) => {
            display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: err, value: res.flight + ' ' + res.timestamp} ]);
        });
    }); */

    

}

// returns airline status code as a string based the (string) status code returned by the smart contract
function airlineStatus(statusCode){
    console.log('statusCode = ', statusCode);
    console.log('typeof(statusCode) = ', typeof(statusCode));
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



function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

}

function refreshAirlinesStatus(){ 
    console.log('hello');
    let tableRow='';               
    flightSuretyApp.methods.getAirlines().call().then( (res,err) => {
        if(!err){
            const airlines = res;
            let promiseVec = [];
            for (let entry of airlines) // loop on airlines
                promiseVec.push(flightSuretyApp.methods.getAirlineStatus(entry).call());
            Promise.all(promiseVec).then(status => {
                console.log('status = ',status);
                if(status.length !== airlines.length)
                    error('status.length !== airlines.length');
                for (let i=0; i < status.length; i++){
                    let entryName = '';
                    let entryIata = '';
                    if (airlinesIDs.has(airlines[i])) {
                        console.log('airlinesIDs.get(entry) = ', airlinesIDs.get(airlines[i]));
                        entryName = airlinesIDs.get(airlines[i]).name;
                        entryIata = airlinesIDs.get(airlines[i]).iata;
                    }else{
                        console.log('airlines[i] = ' + airlines[i] + ' not found in ');
                        console.log('airlinesIDs = ', airlinesIDs);
                    }
                    tableRow += '<tr><td>' + airlines[i] + '</td><td>' + entryName + '</td><td>' + entryIata  + '</td><td>' + airlineStatus(status[i]) + '</td></tr>';
                    console.log('tableRow = ',tableRow);
                }
                htm.airlines.tableStatus.innerHTML = tableRow;
            });                                
        }else{
            console.log('error : ', err);
        }
    });
    
};


window.addEventListener('DOMContentLoaded', initialize('localhost'));



