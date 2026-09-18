// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ArcGuardVault
/// @notice An owner-funded USDC vault with deterministic spending limits for one autonomous agent.
contract ArcGuardVault is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Policy {
        uint256 maxPerTransaction;
        uint256 dailyLimit;
        uint64 expiresAt;
        bool allowlistOnly;
    }

    IERC20 public immutable usdc;
    address public agent;
    Policy public policy;

    mapping(address recipient => bool allowed) public allowedRecipients;
    mapping(uint256 dayId => uint256 amount) public spentByDay;
    mapping(bytes32 paymentId => bool used) public usedPaymentIds;

    error UnauthorizedAgent(address caller);
    error ZeroAddress();
    error ZeroAmount();
    error InvalidPolicy();
    error PolicyInactive();
    error PolicyExpired(uint64 expiresAt);
    error RecipientNotAllowed(address recipient);
    error TransactionLimitExceeded(uint256 requested, uint256 limit);
    error DailyLimitExceeded(uint256 requestedTotal, uint256 limit);
    error PaymentIdAlreadyUsed(bytes32 paymentId);
    error InvalidPaymentId();
    error RenounceOwnershipDisabled();

    event Deposited(address indexed sender, uint256 amount);
    event Spent(
        address indexed agent,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed paymentId,
        uint256 dayId
    );
    event Withdrawn(address indexed recipient, uint256 amount);
    event AgentUpdated(address indexed previousAgent, address indexed newAgent);
    event PolicyUpdated(uint256 maxPerTransaction, uint256 dailyLimit, uint64 expiresAt, bool allowlistOnly);
    event RecipientUpdated(address indexed recipient, bool allowed);

    modifier onlyAgent() {
        if (msg.sender != agent) revert UnauthorizedAgent(msg.sender);
        _;
    }

    constructor(address initialOwner, address usdcAddress) Ownable(initialOwner) {
        if (initialOwner == address(0) || usdcAddress == address(0)) revert ZeroAddress();
        usdc = IERC20(usdcAddress);
    }

    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function spend(address recipient, uint256 amount, bytes32 paymentId)
        external
        onlyAgent
        whenNotPaused
        nonReentrant
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (paymentId == bytes32(0)) revert InvalidPaymentId();
        if (usedPaymentIds[paymentId]) revert PaymentIdAlreadyUsed(paymentId);

        Policy memory currentPolicy = policy;
        if (currentPolicy.maxPerTransaction == 0 || currentPolicy.dailyLimit == 0) revert PolicyInactive();
        if (currentPolicy.expiresAt != 0 && block.timestamp > currentPolicy.expiresAt) {
            revert PolicyExpired(currentPolicy.expiresAt);
        }
        if (currentPolicy.allowlistOnly && !allowedRecipients[recipient]) {
            revert RecipientNotAllowed(recipient);
        }
        if (amount > currentPolicy.maxPerTransaction) {
            revert TransactionLimitExceeded(amount, currentPolicy.maxPerTransaction);
        }

        uint256 dayId = block.timestamp / 1 days;
        uint256 nextDailySpend = spentByDay[dayId] + amount;
        if (nextDailySpend > currentPolicy.dailyLimit) {
            revert DailyLimitExceeded(nextDailySpend, currentPolicy.dailyLimit);
        }

        usedPaymentIds[paymentId] = true;
        spentByDay[dayId] = nextDailySpend;
        usdc.safeTransfer(recipient, amount);

        emit Spent(msg.sender, recipient, amount, paymentId, dayId);
    }

    function setAgent(address newAgent) external onlyOwner {
        if (newAgent == address(0)) revert ZeroAddress();
        address previousAgent = agent;
        agent = newAgent;
        emit AgentUpdated(previousAgent, newAgent);
    }

    function setPolicy(uint256 maxPerTransaction, uint256 dailyLimit, uint64 expiresAt, bool allowlistOnly)
        external
        onlyOwner
    {
        if (
            maxPerTransaction == 0 || dailyLimit == 0 || maxPerTransaction > dailyLimit
                || (expiresAt != 0 && expiresAt <= block.timestamp)
        ) revert InvalidPolicy();

        policy = Policy({
            maxPerTransaction: maxPerTransaction,
            dailyLimit: dailyLimit,
            expiresAt: expiresAt,
            allowlistOnly: allowlistOnly
        });

        emit PolicyUpdated(maxPerTransaction, dailyLimit, expiresAt, allowlistOnly);
    }

    function setRecipient(address recipient, bool allowed) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        allowedRecipients[recipient] = allowed;
        emit RecipientUpdated(recipient, allowed);
    }

    function withdraw(address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        usdc.safeTransfer(recipient, amount);
        emit Withdrawn(recipient, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function currentDayState() external view returns (uint256 dayId, uint256 spent, uint256 remaining) {
        dayId = block.timestamp / 1 days;
        spent = spentByDay[dayId];
        remaining = policy.dailyLimit > spent ? policy.dailyLimit - spent : 0;
    }

    function renounceOwnership() public override onlyOwner {
        revert RenounceOwnershipDisabled();
    }
}
