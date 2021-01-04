import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import DOM from './dom';
//import Contract from './contract';
import './flightsurety.css';

// Dapp overall status info
const htmlCurrentUser = document.getElementById('currentUser');

const isMetaMaskInstalled = () => {
    const { ethereum } = window
    return Boolean(ethereum && ethereum.isMetaMask)
}

const initialize = async(network) => {

    // ***********************************************************************************
    // ************            SETUP METAMASK AND GET USER ACCOUNT            ************
    // ***********************************************************************************

    // check that metamask is installed
    if(!isMetaMaskInstalled())
        window.alert('Metamask is not installed. Please install Metamask to use this site');
    
    // get accounts (should be an array of length 1, with accounts[0] the current account)
    let accounts;
    try {
        accounts = await ethereum.request({
            method: 'eth_requestAccounts',
        });
        htmlCurrentUser.innerHTML = 'Current user: ' + accounts[0];
    } catch (error) {
        console.error(error)
    }
        
    // handle event that informs of account change
    ethereum.on('accountsChanged', (acc) => {
        window.alert('Change to account ' + acc[0]);
        accounts = acc;
        htmlCurrentUser.innerHTML = 'Current user: ' + accounts[0];
    });

    // ***********************************************************************************
    // ************           DEPLOY FLIGHTSURETYAPP SMART CONTRACT           ************
    // ***********************************************************************************

    let config = Config[network];
    let web3 = new Web3(ethereum);
    let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

    // ***********************************************************************************
    // ************               REPAIR INITIAL CAPABILITIES                 ************
    // ***********************************************************************************

    flightSuretyApp.methods.isOperational().call().then( (res,err) => {
        console.log('res = ', res);
        display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: err, value: res} ]);
    });

    DOM.elid('submit-oracle').addEventListener('click', () => {
        let flight = DOM.elid('flight-number').value;
        // Write transaction
        let airline = accounts[0];
        console.log('airline = ',airline);
        flightSuretyApp.methods.fetchFlightStatus(airline,flight,Math.floor(Date.now() / 1000)).call().then( (res,err) => {
            display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: err, value: res.flight + ' ' + res.timestamp} ]);
        });
    });

    

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

window.addEventListener('DOMContentLoaded', initialize('localhost'));





