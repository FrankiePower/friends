use contracts::Pooler::{IPoolerDispatcher, IPoolerDispatcherTrait};
use openzeppelin_testing::declare_and_deploy;
use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{CheatSpan, cheat_caller_address, set_balance, Token};
use starknet::ContractAddress;

// Example addresses (replace with real ones for forked tests)
const OWNER: ContractAddress = 0x01.try_into().unwrap();
const USER1: ContractAddress = 0x02.try_into().unwrap();
const USER2: ContractAddress = 0x03.try_into().unwrap();
const STRK_TOKEN_CONTRACT_ADDRESS: ContractAddress = 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d.try_into().unwrap();

fn deploy_pooler() -> ContractAddress {
    let calldata = array![];
    declare_and_deploy("Pooler", calldata)
}

fn approve_strk(user: ContractAddress, spender: ContractAddress, amount: u256) {
    let erc20_dispatcher = IERC20Dispatcher { contract_address: STRK_TOKEN_CONTRACT_ADDRESS };
    cheat_caller_address(STRK_TOKEN_CONTRACT_ADDRESS, user, CheatSpan::TargetCalls(1));
    erc20_dispatcher.approve(spender, amount);
}

#[test]
fn test_create_and_get_pool() {
    let pooler_addr = deploy_pooler();
    let dispatcher = IPoolerDispatcher { contract_address: pooler_addr };
    let desc: ByteArray = "Trip to Paris";
    let target: u256 = 1000;
    let recipient: ContractAddress = OWNER;
    let pool_id = dispatcher.create_pool(desc.clone(), target, recipient);
    let (desc_out, target_out, recipient_out, total_contributed, is_complete) = dispatcher.get_pool(pool_id);
    assert(desc_out == desc, 'Description mismatch');
    assert(target_out == target, 'Target mismatch');
    assert(recipient_out == recipient, 'Recipient mismatch');
    assert(total_contributed == 0, 'Initial should be zero');
    assert(!is_complete, 'Pool should not be complete');
}

#[test]
fn test_contribute_and_track() {
    let pooler_addr = deploy_pooler();
    let dispatcher = IPoolerDispatcher { contract_address: pooler_addr };
    let desc: ByteArray = "Concert";
    let target: u256 = 500;
    let recipient: ContractAddress = OWNER;
    let pool_id = dispatcher.create_pool(desc, target, recipient);
    // Simulate USER1 contributing
    set_balance(USER1, 200, Token::STRK);
    approve_strk(USER1, pooler_addr, 200);
    cheat_caller_address(pooler_addr, USER1, CheatSpan::TargetCalls(1));
    dispatcher.contribute(pool_id, 200);
    let contrib1 = dispatcher.get_contribution(pool_id, USER1);
    assert(contrib1 == 200, 'USER1 contribution mismatch');
    // Simulate USER2 contributing
    set_balance(USER2, 300, Token::STRK);
    approve_strk(USER2, pooler_addr, 300);
    cheat_caller_address(pooler_addr, USER2, CheatSpan::TargetCalls(1));
    dispatcher.contribute(pool_id, 300);
    let contrib2 = dispatcher.get_contribution(pool_id, USER2);
    assert(contrib2 == 300, 'USER2 contribution mismatch');
    // Total should be 500
    let (_, _, _, total_contributed, _) = dispatcher.get_pool(pool_id);
    assert(total_contributed == 500, 'Total contributed mismatch');
}

#[test]
fn test_mark_complete_and_withdraw() {
    let pooler_addr = deploy_pooler();
    let dispatcher = IPoolerDispatcher { contract_address: pooler_addr };
    let desc: ByteArray = "Rent";
    let target: u256 = 1000;
    let recipient: ContractAddress = OWNER;
    let pool_id = dispatcher.create_pool(desc, target, recipient);
    // Contribute full amount
    set_balance(USER1, 1000, Token::STRK);
    approve_strk(USER1, pooler_addr, 1000);
    cheat_caller_address(pooler_addr, USER1, CheatSpan::TargetCalls(1));
    dispatcher.contribute(pool_id, 1000);
    // Mark complete
    dispatcher.mark_complete(pool_id);
    let (_, _, _, _, is_complete) = dispatcher.get_pool(pool_id);
    assert(is_complete, 'Pool should be complete');
    // Withdraw as recipient
    cheat_caller_address(pooler_addr, OWNER, CheatSpan::TargetCalls(1));
    dispatcher.withdraw(pool_id);
    let (_, _, _, total_contributed, _) = dispatcher.get_pool(pool_id);
    assert(total_contributed == 0, 'empty after withdrawal');
}

#[test]
#[should_panic(expected: "POOL_COMPLETE")]
fn test_cannot_contribute_to_complete_pool_should_revert() {
    let pooler_addr = deploy_pooler();
    let dispatcher = IPoolerDispatcher { contract_address: pooler_addr };
    let desc: ByteArray = "Movie";
    let target: u256 = 100;
    let recipient: ContractAddress = OWNER;
    let pool_id = dispatcher.create_pool(desc, target, recipient);
    set_balance(USER1, 100, Token::STRK);
    approve_strk(USER1, pooler_addr, 100);
    cheat_caller_address(pooler_addr, USER1, CheatSpan::TargetCalls(1));
    dispatcher.contribute(pool_id, 100);
    dispatcher.mark_complete(pool_id);
    // This call should revert, so the test will pass if it does
    cheat_caller_address(pooler_addr, USER1, CheatSpan::TargetCalls(1));
    dispatcher.contribute(pool_id, 10);
}

#[test]
#[should_panic(expected: "NOT_RECIPIENT")]
fn test_only_recipient_can_withdraw_should_revert() {
    let pooler_addr = deploy_pooler();
    let dispatcher = IPoolerDispatcher { contract_address: pooler_addr };
    let desc: ByteArray = "Dinner";
    let target: u256 = 200;
    let recipient: ContractAddress = OWNER;
    let pool_id = dispatcher.create_pool(desc, target, recipient);
    set_balance(USER1, 200, Token::STRK);
    approve_strk(USER1, pooler_addr, 200);
    cheat_caller_address(pooler_addr, USER1, CheatSpan::TargetCalls(1));
    dispatcher.contribute(pool_id, 200);
    dispatcher.mark_complete(pool_id);
    // Try to withdraw as USER2 (should revert)
    cheat_caller_address(pooler_addr, USER2, CheatSpan::TargetCalls(1));
    dispatcher.withdraw(pool_id);
}

#[test]
fn test_multiple_pools_isolation() {
    let pooler_addr = deploy_pooler();
    let dispatcher = IPoolerDispatcher { contract_address: pooler_addr };
    let desc1: ByteArray = "Pool1";
    let desc2: ByteArray = "Pool2";
    let pool_id1 = dispatcher.create_pool(desc1, 100, OWNER);
    let pool_id2 = dispatcher.create_pool(desc2, 200, USER1);
    set_balance(USER1, 250, Token::STRK);
    approve_strk(USER1, pooler_addr, 250);
    cheat_caller_address(pooler_addr, USER1, CheatSpan::TargetCalls(2));
    dispatcher.contribute(pool_id1, 50);
    dispatcher.contribute(pool_id2, 200);
    let contrib1 = dispatcher.get_contribution(pool_id1, USER1);
    let contrib2 = dispatcher.get_contribution(pool_id2, USER1);
    assert(contrib1 == 50, 'Pool1 contribution mismatch');
    assert(contrib2 == 200, 'Pool2 contribution mismatch');
}
