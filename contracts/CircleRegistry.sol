// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CircleRegistry
/// @notice Registry of circles, their hierarchy, and key module addresses.
contract CircleRegistry {
    struct Circle {
        uint256 id;
        uint256 parentId; // 0 for root
        address governor;
        address timelock;
        address treasury;
        address token; // IVotes token used by the governor
        string name;
    }

    event CircleRegistered(
        uint256 indexed id,
        uint256 indexed parentId,
        address governor,
        address timelock,
        address treasury,
        address token,
        string name
    );

    address public owner;
    address public factory; // authorized registrar

    uint256 public nextId = 1;
    mapping(uint256 => Circle) public circles; // id => Circle
    mapping(address => uint256) public circleIdByTimelock; // timelock => id

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyFactory() {
        require(msg.sender == factory, "NOT_FACTORY");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setFactory(address newFactory) external onlyOwner {
        factory = newFactory;
    }

    function exists(uint256 id) public view returns (bool) {
        return id != 0 && id < nextId;
    }

    function totalCircles() external view returns (uint256) {
        return nextId - 1;
    }

    function controllerOf(uint256 id) external view returns (address) {
        return circles[id].timelock;
    }

    function register(
        uint256 parentId,
        address governor,
        address timelock,
        address treasury,
        address token,
        string memory name
    ) external onlyFactory returns (uint256 id) {
        id = nextId++;
        circles[id] = Circle({
            id: id,
            parentId: parentId,
            governor: governor,
            timelock: timelock,
            treasury: treasury,
            token: token,
            name: name
        });
        circleIdByTimelock[timelock] = id;
        emit CircleRegistered(id, parentId, governor, timelock, treasury, token, name);
    }
}

