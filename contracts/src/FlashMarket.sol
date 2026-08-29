// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TheyaMarket {
    uint256 public constant STAKE = 0.01 ether;

    enum Side {
        None,
        Yes,
        No
    }

    enum Outcome {
        Open,
        Yes,
        No,
        Void
    }

    struct Market {
        bytes32 termsHash;
        uint40 closeAt;
        uint32 yesCount;
        uint32 noCount;
        Outcome outcome;
    }

    struct Position {
        Side side;
        uint32 ordinal;
        bool claimed;
    }

    address public owner;
    address public immutable creator;
    address public immutable resolver;
    address public immutable feeRecipient;
    uint256 public marketCount;
    uint256 public feesAccrued;

    mapping(uint256 marketId => Market) public markets;
    mapping(uint256 marketId => mapping(address bettor => Position)) public positions;
    mapping(bytes32 termsHash => bool) public termsUsed;
    mapping(uint256 marketId => uint64 blockNumber) public creationBlocks;
    mapping(uint256 marketId => uint64 blockNumber) public resolutionBlocks;
    mapping(address bettor => uint256[] marketIds) private userMarketIds;

    uint256 private locked = 1;

    error Unauthorized();
    error InvalidAddress();
    error InvalidDeadline();
    error InvalidSide();
    error InvalidStake();
    error MarketMissing();
    error MarketClosed();
    error MarketOpen();
    error MarketSettled();
    error DuplicateMarket();
    error AlreadyBet();
    error NothingToClaim();
    error AlreadyClaimed();
    error InvalidConfidence();
    error TransferFailed();

    event MarketCreated(uint256 indexed marketId, bytes32 indexed termsHash, uint40 closeAt, string metadata);
    event BetPlaced(uint256 indexed marketId, address indexed bettor, Side side, uint32 ordinal);
    event MarketResolved(
        uint256 indexed marketId,
        Outcome outcome,
        string evidenceUri,
        bytes32 indexed evidenceHash,
        uint16 confidenceBps
    );
    event Claimed(uint256 indexed marketId, address indexed bettor, uint256 amount);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    event RoleUpdated(bytes32 indexed role, address indexed account);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert TransferFailed();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address creator_, address resolver_, address feeRecipient_) {
        if (creator_ == address(0) || resolver_ == address(0) || feeRecipient_ == address(0)) {
            revert InvalidAddress();
        }
        owner = msg.sender;
        creator = creator_;
        resolver = resolver_;
        feeRecipient = feeRecipient_;
    }

    function createMarket(bytes32 termsHash, uint40 closeAt, string calldata metadata)
        external
        returns (uint256 marketId)
    {
        if (msg.sender != creator) revert Unauthorized();
        if (closeAt <= block.timestamp) revert InvalidDeadline();
        if (termsUsed[termsHash]) revert DuplicateMarket();

        marketId = ++marketCount;
        termsUsed[termsHash] = true;
        markets[marketId] = Market(termsHash, closeAt, 0, 0, Outcome.Open);
        creationBlocks[marketId] = uint64(block.number);
        emit MarketCreated(marketId, termsHash, closeAt, metadata);
    }

    function bet(uint256 marketId, Side side) external payable {
        Market storage market = markets[marketId];
        if (market.closeAt == 0) revert MarketMissing();
        if (market.outcome != Outcome.Open || block.timestamp >= market.closeAt) revert MarketClosed();
        if (side != Side.Yes && side != Side.No) revert InvalidSide();
        if (msg.value != STAKE) revert InvalidStake();

        Position storage position = positions[marketId][msg.sender];
        if (position.side != Side.None) revert AlreadyBet();

        uint32 ordinal;
        if (side == Side.Yes) {
            ordinal = market.yesCount++;
        } else {
            ordinal = market.noCount++;
        }
        positions[marketId][msg.sender] = Position(side, ordinal, false);
        userMarketIds[msg.sender].push(marketId);
        emit BetPlaced(marketId, msg.sender, side, ordinal);
    }

    function userMarketCount(address bettor) external view returns (uint256) {
        return userMarketIds[bettor].length;
    }

    function userMarketAt(address bettor, uint256 index) external view returns (uint256) {
        return userMarketIds[bettor][index];
    }

    function resolve(
        uint256 marketId,
        Outcome proposedOutcome,
        string calldata evidenceUri,
        bytes32 evidenceHash,
        uint16 confidenceBps
    ) external {
        if (msg.sender != resolver) revert Unauthorized();
        Market storage market = markets[marketId];
        if (market.closeAt == 0) revert MarketMissing();
        if (block.timestamp < market.closeAt) revert MarketOpen();
        if (market.outcome != Outcome.Open) revert MarketSettled();
        if (proposedOutcome == Outcome.Open) revert InvalidSide();
        if (confidenceBps > 10_000) revert InvalidConfidence();

        Outcome finalOutcome = proposedOutcome;
        if (market.yesCount == 0 || market.noCount == 0) finalOutcome = Outcome.Void;
        market.outcome = finalOutcome;
        resolutionBlocks[marketId] = uint64(block.number);

        if (finalOutcome == Outcome.Yes || finalOutcome == Outcome.No) {
            uint256 loserCount = finalOutcome == Outcome.Yes ? market.noCount : market.yesCount;
            uint256 losingPool = loserCount * STAKE;
            feesAccrued += losingPool - ((losingPool * 90) / 100);
        }

        emit MarketResolved(marketId, finalOutcome, evidenceUri, evidenceHash, confidenceBps);
    }

    function cancelMarket(uint256 marketId, string calldata reasonUri) external onlyOwner {
        Market storage market = markets[marketId];
        if (market.closeAt == 0) revert MarketMissing();
        if (market.outcome != Outcome.Open) revert MarketSettled();
        market.outcome = Outcome.Void;
        resolutionBlocks[marketId] = uint64(block.number);
        emit MarketResolved(marketId, Outcome.Void, reasonUri, bytes32(0), 0);
    }

    function claim(uint256 marketId) external nonReentrant returns (uint256 amount) {
        Position storage position = positions[marketId][msg.sender];
        if (position.side == Side.None) revert NothingToClaim();
        if (position.claimed) revert AlreadyClaimed();

        Market storage market = markets[marketId];
        amount = claimable(marketId, msg.sender);
        if (market.outcome == Outcome.Open) revert MarketOpen();

        position.claimed = true;
        if (amount != 0) {
            (bool sent,) = msg.sender.call{value: amount}("");
            if (!sent) revert TransferFailed();
        }
        emit Claimed(marketId, msg.sender, amount);
    }

    function claimable(uint256 marketId, address bettor) public view returns (uint256) {
        Market storage market = markets[marketId];
        Position storage position = positions[marketId][bettor];
        if (market.outcome == Outcome.Open || position.side == Side.None || position.claimed) return 0;
        if (market.outcome == Outcome.Void) return STAKE;

        Side winningSide = market.outcome == Outcome.Yes ? Side.Yes : Side.No;
        if (position.side != winningSide) return 0;

        uint256 winnerCount = winningSide == Side.Yes ? market.yesCount : market.noCount;
        uint256 loserCount = winningSide == Side.Yes ? market.noCount : market.yesCount;
        uint256 rewardPool = (loserCount * STAKE * 90) / 100;
        uint256 share = rewardPool / winnerCount;
        uint256 remainder = rewardPool % winnerCount;
        return STAKE + share + (position.ordinal < remainder ? 1 : 0);
    }

    function withdrawFees() external nonReentrant {
        if (msg.sender != feeRecipient) revert Unauthorized();
        uint256 amount = feesAccrued;
        if (amount == 0) revert NothingToClaim();
        feesAccrued = 0;
        (bool sent,) = feeRecipient.call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit FeesWithdrawn(feeRecipient, amount);
    }

    function transferOwnership(address account) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        owner = account;
        emit RoleUpdated("OWNER", account);
    }
}
