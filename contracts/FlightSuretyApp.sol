// SPDX-License-Identifier: MIT

pragma solidity >= 0.6.2;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/
import "../node_modules/@openzeppelin/contracts/math/SafeMath.sol";
import "./FlightSuretyData.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;          // Account used to deploy contract

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;        
        address airline;
    }
    mapping(bytes32 => Flight) private flights;

    /* ******************************* Management of airlines ************************************/

    // max number of airlines below which 50% multiparty consensus is required
    uint8 private constant MAX_AIRLINES_SINGLEPARTY_CONSENSUS = 4;
    // list of addresses of registered airlines
    address[] private registeredAirlines = new address[](0); 
    // mapping of registered airlines
    mapping(address => bool) private mapRegisteredAirlines;
    // queue of airlines in the process of being registered
    mapping(address => address[]) private queueAirlines;
    // list of funded airlines
    address[] private fundedAirlines = new address[](0); 
    // mapping of funded airlines
    mapping(address => bool) private mapFundedAirlines;

    /* ******************************* Management of contract ************************************/
    bool private operational = true;
    FlightSuretyData private flightSuretyData;
    bool private firstTime = true; // used to check that registerFirstAirline is only called once

// region modifiers
    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    /// @dev Modifier that requires the "operational" boolean variable to be "true"
    modifier requireIsOperational(){
         // Modify to call data contract's status
        require(operational, "Contract is currently not operational");  
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /// @dev Modifier that requires the "ContractOwner" account to be the function caller
    modifier requireContractOwner(){
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /// @dev Modifier that requires the caller to be a registered airline
    modifier requireRegisteredAirline(){
        require(mapRegisteredAirlines[msg.sender], "Caller is not a registered airline");
        _;
    }

    /// @dev Modifier that requires the caller to be a funded airline
    modifier requireFundedAirline(){
        require(mapFundedAirlines[msg.sender], "Caller is not a funded airline");
        _;
    }
// endregion

// region constructor_fallback
    /********************************************************************************************/
    /*                                   CONSTRUCTOR & FALLBACK                                 */
    /********************************************************************************************/

    /// @dev Contract constructor
    constructor(address dataContractAddress, address firstAirline) public {
        require(dataContractAddress != address(0));
        contractOwner = msg.sender;
        // initialize data contract
        flightSuretyData = FlightSuretyData(dataContractAddress);  
        // register contract owner as first airine
        _registerAirline(firstAirline);
    }

    /********************************************************************************************/
    /*                                           FALLBACK                                       */
    /********************************************************************************************/

    /// @dev make sure fallback function is not not payable so can't be used for funding smart contract
    fallback() external {
    }
// endregion

// region utility_testing
    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /// @dev Get operating status of contract
    /// @return A bool that is the current operating status
    function isOperational() public view returns(bool) {
        return operational;
    }

    /// @dev Sets contract operations on/off
    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                 FUNCTIONS FOR TESTING ONLY                               */
    /********************************************************************************************/

    /// @dev used for testing requireIsOperational, always returns true
    function testIsOperational() public view requireIsOperational returns(bool) {
        return true;
    }
//endregion    

// region smart_contract
    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
    * @notice Attempts to register and airline. For the first MAX_AIRLINES_SINGLEPARTY_CONSENSUS
    * airlines this is a simple request from a funded airline. After that it becomes a multiparty
    * consensus where a number of funded airlines at least equal to 50% of the number of registered
    * airlines need to request the airline registration.
    * @dev Add an airline to the registration queue
    * @return success a bool indicating if the airline is registered
    * @return votes a uint256 with the number of votes
    */   
    function registerAirline(address airline)
        external
        requireIsOperational
        requireFundedAirline                            
        returns(bool success, uint256 votes)
    {        
        // check that airline is not already registered
        require(mapRegisteredAirlines[airline] == false);

        // decide whether to use multiparty consensus or not
        if(registeredAirlines.length < MAX_AIRLINES_SINGLEPARTY_CONSENSUS){
            votes = 1;
            success = _registerAirline(airline);
        }else{
            uint256 currentVotes = queueAirlines[airline].length;
            if(currentVotes == 0){
                queueAirlines[airline] = new address[](0);
                queueAirlines[airline].push(msg.sender);
                success = false;
                votes = 1;
            }else{
                // loop on current votes to make sure there is no double voting by the same airline
                uint256 c = 0;
                for(; c < currentVotes; c++){
                    if(queueAirlines[airline][c] == msg.sender) // double voting by msg.sender
                        break;
                }
                if(c == currentVotes) // no double voting by msg.sender
                    queueAirlines[airline].push(msg.sender); // add vote
                // update votes
                votes = queueAirlines[airline].length;
                if(votes.mul(2) >= registeredAirlines.length)
                    success = _registerAirline(airline);
                else
                    success = false;
            }
        }
        return (success, votes);
    }

    /// @notice Register the first airline
    /// @dev This function is required because registerAirline can only be called by a funded airline,
    ///      which needs to be registered before it can be funded
    // function registerFirstAirline(address airline)
    //     external
    //     requireIsOperational
    //     requireContractOwner                            
    //     returns(bool success)
    // {        
    //     // check that airline is not already registered
    //     require(firstTime);
    //     // register airline
    //     success = _registerAirline(airline);
    //     // make sure this function can't be called again
    //     if (success)
    //         firstTime = false ;
    // }


    /// @dev Register an airline
    function _registerAirline(address airline)
        private 
        requireIsOperational  
        returns(bool success)                         
    {
        // check that airline is not already registered
        require(mapRegisteredAirlines[airline] == false);
        // mark airline as registered
        mapRegisteredAirlines[airline] = true;
        // add airine to list of registed airlines
        registeredAirlines.push(airline);
        // just in case, make sure entry in queueAirlines is empty
        if(queueAirlines[airline].length != 0)
            delete queueAirlines[airline];
        return true;
    }

    /// @dev Check if an airline is registered
    function isRegisteredAirline(address airline) external view returns(bool) {
        return mapRegisteredAirlines[airline];
    }

    /// @dev allow a registered airline to fund itself
    function fund()
        external
        payable
        requireIsOperational
        requireRegisteredAirline
    {
        require(msg.value == 10 ether);
        // make sure an airline can only be funded once
        require(mapFundedAirlines[msg.sender] == false);
        mapFundedAirlines[msg.sender] = true;

        // forward funds to data contract
        flightSuretyData.fund{value:msg.value}(msg.sender);
    }

    /// @dev Check if an airline is funded
    function isFundedAirline(address airline) external view returns(bool) {
        return mapFundedAirlines[airline];
    }

    /// @dev Register a future flight for insuring.
    function registerFlight
                                (
                                )
                                external
                                pure
    {

    }
    
    /// @dev Called after oracle has updated flight status
    function processFlightStatus
                                (
                                    address airline,
                                    string memory flight,
                                    uint256 timestamp,
                                    uint8 statusCode
                                )
                                internal
                                pure
    {
    }


    // Generate a request for oracles to fetch flight information - triggered from UI
    function fetchFlightStatus
                        (
                            address airline,
                            string calldata flight,
                            uint256 timestamp                            
                        )
                        external
    {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp));
        oracleResponses[key] = ResponseInfo({
                                                requester: msg.sender,
                                                isOpen: true
                                            });

        emit OracleRequest(index, airline, flight, timestamp);
    } 
// endregion

// region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;    

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;        
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester;                              // Account that requested status
        bool isOpen;                                    // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);


    // Register an oracle with the contract
    function registerOracle
                            (
                            )
                            external
                            payable
    {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
                                        isRegistered: true,
                                        indexes: indexes
                                    });
    }

    function getMyIndexes
                            (
                            )
                            view
                            external
                            returns(uint8[3] memory)
    {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }




    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse
                        (
                            uint8 index,
                            address airline,
                            string calldata flight,
                            uint256 timestamp,
                            uint8 statusCode
                        )
                        external
    {
        require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index), "Index does not match oracle request");


        bytes32 key = keccak256(abi.encodePacked(index, airline, flight, timestamp)); 
        require(oracleResponses[key].isOpen, "Flight or timestamp do not match oracle request");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES) {

            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }


    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes
                            (                       
                                address account         
                            )
                            internal
                            returns(uint8[3] memory)
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);
        
        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex
                            (
                                address account
                            )
                            internal
                            returns (uint8)
    {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

// endregion

}   
