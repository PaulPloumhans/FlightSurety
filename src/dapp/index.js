
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';

// Dapp overall status info
const htmlCurrentUser = document.getElementById('currentUser');

const isMetaMaskInstalled = () => {
    const { ethereum } = window
    return Boolean(ethereum && ethereum.isMetaMask)
}

const initialize = async() => {

    // ************************** SETUP METAMASK AND GET USER ACCOUNT ********************

    // check that metamask is installed
    if(!isMetaMaskInstalled())
        window.alert('Metamask is not installed. Please install Metamask to use this site');
    else
        console.log('Metamask installed : ', isMetaMaskInstalled());

    // get accounts (should be an array of length 1, with accounts[0] the current account)
    let accounts;
    try {
        accounts = await ethereum.request({
            method: 'eth_requestAccounts',
        });
    } catch (error) {
        console.error(error)
    }
    // output current user
    htmlCurrentUser.innerHTML = 'Current user: ' + accounts[0];

    // handle event that informs of account change
    ethereum.on('accountsChanged', (acc) => {
        window.alert('Change to account ' + acc[0]);
        accounts = acc;
        htmlCurrentUser.innerHTML = 'Current user: ' + accounts[0];
    });

    
    
    
    let result = null;

    let contract = new Contract('localhost', () => {

        // display current user
        // initially user = contract deployer
        contract.web3.eth.getAccounts((error,accts) => {
            //document.getElementById('current-user').innerHTML = 'Current user: ' + accts[0];
        });
        // update current user
        var subscription = contract.web3.eth.subscribe('accountsChanged', function(error, result){
            console.log('account changed');
            contract.web3.eth.getAccounts((err,accounts) => {
                //document.getElementById('current-user').innerHTML = 'Current user: ' + accounts[0];
                console.log('accounts: ' + accounts);
            });
            if (!error)
                console.log(result);
        });

        /* window.ethereum.on('accountsChanged', () => {
            contract.web3.eth.getAccounts((error,accounts) => {
                document.getElementById('current-user').innerHTML = 'Current user: ' + accounts[0];
                console.log('accounts: ' + accounts);
            });
        }); */
        

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error,result);
            display('Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        });
    

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.elid('flight-number').value;
            // Write transaction
            contract.fetchFlightStatus(flight, (error, result) => {
                display('Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result.timestamp} ]);
            });
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

window.addEventListener('DOMContentLoaded', initialize);





