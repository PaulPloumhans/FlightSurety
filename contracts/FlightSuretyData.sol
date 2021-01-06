// SPDX-License-Identifier: MIT

pragma solidity >= 0.6.2;

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
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline
                            (   
                            )
                            external
                            pure
    {
    }


   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy
                            (                             
                            )
                            external
                            payable
    {

    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                )
                                external
                                pure
    {
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree (to be called after creditInsurees)
     *
    */
    function pay
                            (
                            )
                            external
                            pure
    {
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

