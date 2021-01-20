// SPDX-License-Identifier: MIT

pragma solidity >= 0.6.2;
pragma experimental ABIEncoderV2;

import "../node_modules/@openzeppelin/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // management of contract
    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    mapping(address => bool) private authorizedCallers;                 // all authorized contracts (callers)

    // management of airlines - here we only care that an airline is funded
    // (the registration is a prerequisite taken care of in the App contract)
    mapping(address => bool) private fundedAirlines;                    // funded (and thus also approved) airlines

    // data of passenger insurance
    struct InsuranceData {        
        address airline;
        string flight;
        uint256 timestamp;        
    }
    // record meta data of insurance in smart contract
    // key = flight key, value = meta data
    mapping(bytes32 => InsuranceData) private insuranceDataPerFlightKey; 

    // all keys ever used in a flight insurance
    bytes32[] private allKeys;

    // all insuree ever involved in a flight insurance
    address[] private allInsurees;

    // store premia paid for insuraces by insuree (passenger)
    // first key = result of getFlightKey, second key is address of insuree, value is premium
    mapping(bytes32 => mapping(address => uint256)) private insurancesPerKey;

    // store premia paid for insuraces by insuree (passenger)
    // first key = address of insuress, second key is result of getFlightKey
    //mapping(address => mapping(bytes32 => uint256)) private insurancesPerInsuree;

    // store credit of passengers, key = address of insuree, value = credit due to insuree
    mapping(address => uint256) private credit;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    /********************************************************************************************/
    /*                                 CONSTRUCTOR & FALLBACK                                   */
    /********************************************************************************************/

    /// @dev Constructor
    ///      The deploying account becomes contractOwner
    constructor() public {
        contractOwner = msg.sender;
    }

    /// @dev make sure fallback function is not not payable so can't be used for funding smart contract
    fallback() external {
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /// @dev Modifier that requires the "operational" boolean variable to be "true"
    ///      This is used on all state changing functions to pause the contract in 
    ///      the event there is an issue that needs to be fixed
    modifier requireIsOperational(){
        require(operational, "Contract FlightSuretyData is currently not operational");
        _;
    }

    /// @dev Modifier that requires the "ContractOwner" account to be the function caller
    modifier requireContractOwner(){
        require(msg.sender == contractOwner, "Caller of FlightSuretyData is not contract owner");
        _;
    }

    /// @dev Modifier that requires the function caller to be authorized
    modifier requireAuthorizedCaller(){
        require(authorizedCallers[msg.sender], "Caller of FlightSuretyData is not authorized");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /// @dev Get operating status of contract
    /// @return A bool that is the current operating status
    function isOperational() public view returns(bool) {
        return operational;
    }

    /// @dev Sets contract operations on/off
    /// When operational mode is disabled, all write transactions except for this one will fail
    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    /// @dev Add an authorized address
    function authorizeCaller(address _address) external requireContractOwner {
        authorizedCallers[_address] = true;
    }

    /// @dev Remove an authorized address
    function deAuthorizeCaller(address _address) private requireContractOwner {
        authorizedCallers[_address] = false;
    }

    /********************************************************************************************/
    /*                                 FUNCTIONS FOR TESTING ONLY                               */
    /********************************************************************************************/

    /// @dev used for testing requireIsOperational, always returns true
    function testIsOperational() public view requireIsOperational returns(bool) {
        return true;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy (address airline, string memory flight, uint256 timestamp, address insuree)
        external
        payable
        requireAuthorizedCaller
    {
        // get flight key
        bytes32 key = getFlightKey(airline, flight, timestamp);
        // add insurance to insurances
        require(insurancesPerKey[key][insuree] == 0) ; // only one insurance allowed per passenger per flight
        //require(insurancesPerInsuree[insuree][key] == 0);
        // record insurance metadata
        insuranceDataPerFlightKey[key] = InsuranceData({airline : airline, flight : flight, timestamp : timestamp}); // record meta data of insurance in smart contract
        // book insurance premium
        insurancesPerKey[key][insuree] = msg.value;
        //insurancesPerInsuree[key][insuree] = msg.value;
        // add key to list of keys
        uint256 i=0;
        for(i=0; i<allKeys.length; i++)
            if(allKeys[i]==key)
                break;
        if(i==allKeys.length) // first time this key appears
            allKeys.push(key);
        // add insuree to list of insurees
        for(i=0; i<allInsurees.length; i++)
            if(allInsurees[i]==insuree)
                break;
        if(i==allInsurees.length) // first time this key appears
            allInsurees.push(insuree);        
    }

    /**
     *  @dev Credits payouts to insurees whose insurance matches getFlightKey(airline, flight, timestamp)
    */
    function creditInsurees (
        address airline,
        string memory flight,
        uint256 timestamp,
        uint256 payOffNumerator,
        uint256 payOffDenominator
    )
        external
        requireAuthorizedCaller
    {
        // get flight key
        bytes32 key = getFlightKey(airline, flight, timestamp);
        // loop on insurees
        for (uint256 i=0; i<allInsurees.length; i++){
            // address of insuree
            address insuree = allInsurees[i];
            // multiply paid premium by payOff
            uint256 payout = (insurancesPerKey[key][insuree]).mul(payOffNumerator).div(payOffDenominator);
            // set insured amount for flight to 0
            insurancesPerKey[key][insuree] = 0;
            //insurancesPerInsuree[insuree][key] = 0;
            // update insuree credit
            credit[insuree] = credit[insuree].add(payout);
        }                    
    }

    /**
     *  @dev Transfers passengers paid premia to insurance definitely (because flight was not delayed due to an airline fault)
     *
    */
    function terminateInsurance(address airline, string memory flight, uint256 timestamp) external requireAuthorizedCaller{
        // get flight key
        bytes32 key = getFlightKey(airline, flight, timestamp);
        // loop on insurees
        for (uint256 i=0; i<allInsurees.length; i++){
            // address of insuree
            address insuree = allInsurees[i];
            // set insured amount for flight to 0
            insurancesPerKey[key][insuree] = 0;
            //insurancesPerInsuree[insuree][key] = 0;
        }        
    }

    /**
     *  @dev Transfers eligible payout funds to insuree (to be called after creditInsurees)
     *
    */
    function pay(address passenger) external requireAuthorizedCaller{
        uint256 amount = credit[passenger];
        credit[passenger] = 0;
        payable(passenger).transfer(amount);
    }

    /**
     *  @dev Returns credit of a passenger
     *
    */
    function getCredit(address passenger) view external requireAuthorizedCaller returns(uint256){
        return credit[passenger];        
    }

    /**
     *  @dev Returns amount (premium) of passenger insurance
     *
    */
    function getInsurance(address passenger, address airline, string memory flight, uint256 timestamp) view external requireAuthorizedCaller returns(uint256){
        // get flight key
        bytes32 key = getFlightKey(airline, flight, timestamp);
        return insurancesPerKey[key][passenger];
    }

    /**
     *  @dev Returns list of active insurances' keys for a given passenger
     *
    */
    function getActiveInsuranceKeys(address insuree)
        view
        external
        requireAuthorizedCaller
        returns(bytes32[] memory activeInsuranceKeys, uint256 nActiveInsurances)
    {
        nActiveInsurances = 0;

        // find number of active insurances of current passenger
        for (uint256 i=0; i<allKeys.length; i++){
            bytes32 key = allKeys[i];
            if(insurancesPerKey[key][insuree] != 0){ // active insurance
                nActiveInsurances++;
            }
        }

        activeInsuranceKeys = new bytes32[](nActiveInsurances);
        uint256 idx = 0;
        for (uint256 i=0; i<allKeys.length; i++){
            bytes32 key = allKeys[i];
            if(insurancesPerKey[key][insuree] != 0){ // active insurance
                activeInsuranceKeys[idx] = key;
                idx++;
            }
        }
        // we need to return the num of active insurances, otherwise too much is returned
        // if an insurance is removed before another is added
        return (activeInsuranceKeys, nActiveInsurances);
    }

    /**
     *  @dev Returns insurance data for a given key
     *
    */
    function getInsuranceData(bytes32 key) view external requireAuthorizedCaller returns(address airline, string memory flight, uint256 timestamp){
        InsuranceData memory data = insuranceDataPerFlightKey[key];
        return (data.airline, data.flight, data.timestamp);
    }


    function getFlightKey(address airline, string memory flight, uint256 timestamp)
        pure
        internal
        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining.
    *      New airlines joining the insurance first need to register (and be approved), and once
    *      they are they need to fund the insurance to be activated.
    */   
    function fund(address airline) external payable requireAuthorizedCaller {
        // make sure an airline is only funded once
        require(fundedAirlines[airline] == false);
        // check funding amount
        require(msg.value == 10 ether);
        // flag airline as funded
        fundedAirlines[airline] = true;
    }


}

