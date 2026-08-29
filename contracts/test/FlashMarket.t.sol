// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {TheyaMarket} from "../src/FlashMarket.sol";

contract ReentrantWinner {
    TheyaMarket public immutable market;
    uint256 public marketId;
    bool public attempted;

    constructor(TheyaMarket market_) {
        market = market_;
    }

    function place(uint256 id, TheyaMarket.Side side) external payable {
        marketId = id;
        market.bet{value: msg.value}(id, side);
    }

    function collect() external {
        market.claim(marketId);
    }

    receive() external payable {
        attempted = true;
        (bool blocked,) = address(market).call(abi.encodeCall(market.claim, (marketId)));
        blocked;
    }
}

contract RejectingWinner {
    TheyaMarket public immutable market;

    constructor(TheyaMarket market_) {
        market = market_;
    }

    function place(uint256 id, TheyaMarket.Side side) external payable {
        market.bet{value: msg.value}(id, side);
    }

    function collect(uint256 id) external {
        market.claim(id);
    }

    receive() external payable {
        revert();
    }
}

contract TheyaMarketTest is Test {
    uint256 internal constant STAKE = 0.01 ether;

    TheyaMarket internal market;
    address internal creator = makeAddr("creator");
    address internal resolver = makeAddr("resolver");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    uint256 internal marketId;

    function setUp() public {
        market = new TheyaMarket(creator, resolver, treasury);
        marketId = _create(block.timestamp + 1 days);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function _create(uint256 closeAt) internal returns (uint256 id) {
        bytes32 termsHash = keccak256(abi.encode("terms", closeAt, market.marketCount()));
        vm.prank(creator);
        id = market.createMarket(
            termsHash,
            uint40(closeAt),
            '{"title":"Headline","summary":"Summary","source":"Source","sourceUrl":"https://source.example/story","imageUrl":"https://source.example/image.jpg","question":"Will the event happen?","criteria":"YES only if two allowed sources confirm before close."}'
        );
    }

    function _bet(address bettor, uint256 id, TheyaMarket.Side side) internal {
        vm.prank(bettor);
        market.bet{value: STAKE}(id, side);
    }

    function _resolve(uint256 id, TheyaMarket.Outcome outcome) internal {
        (, uint40 closeAt,,,) = market.markets(id);
        vm.warp(closeAt);
        vm.prank(resolver);
        market.resolve(id, outcome, "ipfs://evidence", keccak256("evidence"), 9_200);
    }

    function test_CreateAndBetOnce() public {
        assertEq(market.creationBlocks(marketId), block.number);
        assertEq(market.userMarketCount(alice), 0);
        _bet(alice, marketId, TheyaMarket.Side.Yes);
        assertEq(market.userMarketCount(alice), 1);
        assertEq(market.userMarketAt(alice, 0), marketId);
        (TheyaMarket.Side side, uint32 ordinal, bool claimed) = market.positions(marketId, alice);
        assertEq(uint8(side), uint8(TheyaMarket.Side.Yes));
        assertEq(ordinal, 0);
        assertFalse(claimed);

        vm.prank(alice);
        vm.expectRevert(TheyaMarket.AlreadyBet.selector);
        market.bet{value: STAKE}(marketId, TheyaMarket.Side.No);
    }

    function test_DuplicateTermsCannotBeCreated() public {
        (bytes32 termsHash,,,,) = market.markets(marketId);
        vm.prank(creator);
        vm.expectRevert(TheyaMarket.DuplicateMarket.selector);
        market.createMarket(termsHash, uint40(block.timestamp + 2 days), "{}");
    }

    function test_BetRequiresExactStakeAndOpenMarket() public {
        vm.prank(alice);
        vm.expectRevert(TheyaMarket.InvalidStake.selector);
        market.bet{value: 1}(marketId, TheyaMarket.Side.Yes);

        (, uint40 closeAt,,,) = market.markets(marketId);
        vm.warp(closeAt);
        vm.prank(alice);
        vm.expectRevert(TheyaMarket.MarketClosed.selector);
        market.bet{value: STAKE}(marketId, TheyaMarket.Side.Yes);
    }

    function test_RolesAndDeadlinesAreEnforced() public {
        vm.expectRevert(TheyaMarket.Unauthorized.selector);
        market.createMarket(bytes32(0), uint40(block.timestamp + 1), "{}");

        vm.prank(resolver);
        vm.expectRevert(TheyaMarket.MarketOpen.selector);
        market.resolve(marketId, TheyaMarket.Outcome.Yes, "", bytes32(0), 10_000);

        (, uint40 closeAt,,,) = market.markets(marketId);
        vm.warp(closeAt);
        vm.prank(alice);
        vm.expectRevert(TheyaMarket.Unauthorized.selector);
        market.resolve(marketId, TheyaMarket.Outcome.Yes, "", bytes32(0), 10_000);
    }

    function test_DistributesNinetyPercentAndAccruesTenPercent() public {
        address carol = makeAddr("carol");
        address dave = makeAddr("dave");
        address eve = makeAddr("eve");
        vm.deal(carol, 1 ether);
        vm.deal(dave, 1 ether);
        vm.deal(eve, 1 ether);

        _bet(alice, marketId, TheyaMarket.Side.Yes);
        _bet(bob, marketId, TheyaMarket.Side.Yes);
        _bet(carol, marketId, TheyaMarket.Side.No);
        _bet(dave, marketId, TheyaMarket.Side.No);
        _bet(eve, marketId, TheyaMarket.Side.No);
        _resolve(marketId, TheyaMarket.Outcome.Yes);
        assertEq(market.resolutionBlocks(marketId), block.number);

        uint256 rewardPool = (3 * market.STAKE() * 90) / 100;
        assertEq(market.claimable(marketId, alice), market.STAKE() + rewardPool / 2);
        assertEq(market.claimable(marketId, bob), market.STAKE() + rewardPool / 2);
        assertEq(market.feesAccrued(), 3 * market.STAKE() - rewardPool);

        uint256 before = alice.balance;
        vm.prank(alice);
        market.claim(marketId);
        assertEq(alice.balance - before, market.STAKE() + rewardPool / 2);

        vm.prank(alice);
        vm.expectRevert(TheyaMarket.AlreadyClaimed.selector);
        market.claim(marketId);
    }

    function test_DistributesEveryRemainderWei() public {
        uint256 winners = 7;
        for (uint256 i; i < winners; ++i) {
            address bettor = address(uint160(100 + i));
            vm.deal(bettor, 1 ether);
            _bet(bettor, marketId, TheyaMarket.Side.Yes);
        }
        _bet(alice, marketId, TheyaMarket.Side.No);
        _resolve(marketId, TheyaMarket.Outcome.Yes);

        uint256 total;
        for (uint256 i; i < winners; ++i) {
            total += market.claimable(marketId, address(uint160(100 + i)));
        }
        uint256 rewardPool = (market.STAKE() * 90) / 100;
        assertEq(total, winners * market.STAKE() + rewardPool);
    }

    function test_OneSidedMarketVoidsAndRefunds() public {
        _bet(alice, marketId, TheyaMarket.Side.No);
        _resolve(marketId, TheyaMarket.Outcome.Yes);

        (,,,, TheyaMarket.Outcome outcome) = market.markets(marketId);
        assertEq(uint8(outcome), uint8(TheyaMarket.Outcome.Void));
        assertEq(market.claimable(marketId, alice), market.STAKE());
        assertEq(market.feesAccrued(), 0);
    }

    function test_OwnerCanCancelButCannotResolve() public {
        _bet(alice, marketId, TheyaMarket.Side.Yes);
        market.cancelMarket(marketId, "ipfs://cancellation");
        assertEq(market.claimable(marketId, alice), market.STAKE());

        uint256 otherId = _create(block.timestamp + 1 days);
        vm.expectRevert(TheyaMarket.Unauthorized.selector);
        market.resolve(otherId, TheyaMarket.Outcome.Yes, "", bytes32(0), 0);
    }

    function test_ReentrancyCannotDoubleClaim() public {
        ReentrantWinner attacker = new ReentrantWinner(market);
        attacker.place{value: STAKE}(marketId, TheyaMarket.Side.Yes);
        _bet(alice, marketId, TheyaMarket.Side.No);
        _resolve(marketId, TheyaMarket.Outcome.Yes);

        uint256 expected = market.claimable(marketId, address(attacker));
        uint256 before = address(attacker).balance;
        attacker.collect();
        assertTrue(attacker.attempted());
        assertEq(address(attacker).balance - before, expected);
        assertEq(market.claimable(marketId, address(attacker)), 0);
    }

    function test_FailedTransferDoesNotConsumeClaim() public {
        RejectingWinner rejector = new RejectingWinner(market);
        rejector.place{value: STAKE}(marketId, TheyaMarket.Side.Yes);
        _bet(alice, marketId, TheyaMarket.Side.No);
        _resolve(marketId, TheyaMarket.Outcome.Yes);

        vm.expectRevert(TheyaMarket.TransferFailed.selector);
        rejector.collect(marketId);
        (,, bool claimed) = market.positions(marketId, address(rejector));
        assertFalse(claimed);
    }

    function testFuzz_TotalLiabilityNeverExceedsPool(uint8 yesSeed, uint8 noSeed, bool yesWins) public {
        uint256 yesCount = bound(yesSeed, 1, 20);
        uint256 noCount = bound(noSeed, 1, 20);
        uint256 id = _create(block.timestamp + 2 days);

        for (uint256 i; i < yesCount; ++i) {
            address bettor = address(uint160(1_000 + i));
            vm.deal(bettor, market.STAKE());
            _bet(bettor, id, TheyaMarket.Side.Yes);
        }
        for (uint256 i; i < noCount; ++i) {
            address bettor = address(uint160(2_000 + i));
            vm.deal(bettor, market.STAKE());
            _bet(bettor, id, TheyaMarket.Side.No);
        }
        _resolve(id, yesWins ? TheyaMarket.Outcome.Yes : TheyaMarket.Outcome.No);

        uint256 liabilities = market.feesAccrued();
        for (uint256 i; i < yesCount; ++i) {
            liabilities += market.claimable(id, address(uint160(1_000 + i)));
        }
        for (uint256 i; i < noCount; ++i) {
            liabilities += market.claimable(id, address(uint160(2_000 + i)));
        }
        assertEq(liabilities, (yesCount + noCount) * market.STAKE());
    }
}
