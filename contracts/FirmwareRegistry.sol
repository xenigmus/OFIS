// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title FirmwareRegistry
 * @dev Smart contract for immutable firmware hash storage and verification
 */
contract FirmwareRegistry {
    
    struct FirmwareRecord {
        string deviceModel;
        string version;
        bytes32 firmwareHash;
        uint256 timestamp;
        address publisher;
        bool exists;
    }
    
    // Mapping: deviceModel => version => FirmwareRecord
    mapping(string => mapping(string => FirmwareRecord)) public firmwareRecords;
    
    // Owner of the contract (authorized publisher)
    address public owner;
    
    // Events
    event FirmwarePublished(
        string deviceModel,
        string version,
        bytes32 firmwareHash,
        address publisher,
        uint256 timestamp
    );
    
    event FirmwareVerified(
        string deviceModel,
        string version,
        bool isValid
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can publish firmware");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Publish a new firmware hash to the blockchain
     * @param deviceModel Model identifier of the device
     * @param version Firmware version string
     * @param firmwareHash SHA256 hash of the firmware binary
     */
    function publishFirmware(
        string memory deviceModel,
        string memory version,
        bytes32 firmwareHash
    ) public {
        require(!firmwareRecords[deviceModel][version].exists, "Version already published");
        require(firmwareHash != bytes32(0), "Invalid firmware hash");
        
        firmwareRecords[deviceModel][version] = FirmwareRecord({
            deviceModel: deviceModel,
            version: version,
            firmwareHash: firmwareHash,
            timestamp: block.timestamp,
            publisher: msg.sender,
            exists: true
        });
        
        emit FirmwarePublished(deviceModel, version, firmwareHash, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Verify firmware integrity by comparing hashes
     * @param deviceModel Model identifier of the device
     * @param version Firmware version to verify
     * @param providedHash Hash to verify against stored record
     * @return isValid True if hashes match, false otherwise
     */
    function verifyFirmware(
        string memory deviceModel,
        string memory version,
        bytes32 providedHash
    ) public returns (bool isValid) {
        FirmwareRecord memory record = firmwareRecords[deviceModel][version];
        
        require(record.exists, "Firmware record not found");
        
        isValid = (record.firmwareHash == providedHash);
        
        emit FirmwareVerified(deviceModel, version, isValid);
        
        return isValid;
    }
    
    /**
     * @dev Get firmware record details
     * @param deviceModel Model identifier
     * @param version Firmware version
     * @return firmwareHash The SHA256 hash of the firmware
     * @return timestamp When the firmware was published
     * @return publisher Who published the firmware
     * @return exists Whether the record exists
     */
    function getFirmwareRecord(
        string memory deviceModel,
        string memory version
    ) public view returns (
        bytes32 firmwareHash,
        uint256 timestamp,
        address publisher,
        bool exists
    ) {
        FirmwareRecord memory record = firmwareRecords[deviceModel][version];
        return (
            record.firmwareHash,
            record.timestamp,
            record.publisher,
            record.exists
        );
    }
    
    /**
     * @dev Transfer ownership to a new address
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Invalid new owner address");
        owner = newOwner;
    }
}
