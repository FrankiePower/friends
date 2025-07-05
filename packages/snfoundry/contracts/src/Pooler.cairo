use starknet::ContractAddress;
use starknet::storage::*;
use starknet::get_caller_address;
use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

// STRK contract address (mainnet/testnet, update as needed)
const STRK_CONTRACT: felt252 = 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d;

#[starknet::interface]
pub trait IPooler<TContractState> {
    fn create_pool(ref self: TContractState, description: ByteArray, target_amount: u256, recipient: ContractAddress) -> u64;
    fn contribute(ref self: TContractState, pool_id: u64, amount: u256);
    fn get_pool(self: @TContractState, pool_id: u64) -> (ByteArray, u256, ContractAddress, u256, bool);
    fn get_contribution(self: @TContractState, pool_id: u64, user: ContractAddress) -> u256;
    fn mark_complete(ref self: TContractState, pool_id: u64);
    fn withdraw(ref self: TContractState, pool_id: u64);
    fn get_all_pools(self: @TContractState) -> Array<(ByteArray, u256, ContractAddress, u256, bool)>;
}

#[starknet::contract]
pub mod Pooler {
    use super::*;
    use starknet::get_contract_address;

    #[storage]
    pub struct Storage {
        pool_description: Map<u64, ByteArray>,
        pool_target_amount: Map<u64, u256>,
        pool_recipient: Map<u64, ContractAddress>,
        pool_total_contributed: Map<u64, u256>,
        pool_is_complete: Map<u64, bool>,
        contributions: Map<u64, Map<ContractAddress, u256>>,
        next_pool_id: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PoolCreated: PoolCreated,
        Contributed: Contributed,
        PoolCompleted: PoolCompleted,
        Withdrawn: Withdrawn,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PoolCreated {
        pool_id: u64,
        creator: ContractAddress,
    }
    #[derive(Drop, starknet::Event)]
    pub struct Contributed {
        pool_id: u64,
        contributor: ContractAddress,
        amount: u256,
    }
    #[derive(Drop, starknet::Event)]
    pub struct PoolCompleted {
        pool_id: u64,
    }
    #[derive(Drop, starknet::Event)]
    pub struct Withdrawn {
        pool_id: u64,
        recipient: ContractAddress,
        amount: u256,
    }

    #[abi(embed_v0)]
    pub impl PoolerImpl of super::IPooler<ContractState> {
        fn create_pool(ref self: ContractState, description: ByteArray, target_amount: u256, recipient: ContractAddress) -> u64 {
            let pool_id = self.next_pool_id.read();
            self.pool_description.write(pool_id, description);
            self.pool_target_amount.write(pool_id, target_amount);
            self.pool_recipient.write(pool_id, recipient);
            self.pool_total_contributed.write(pool_id, 0);
            self.pool_is_complete.write(pool_id, false);
            self.next_pool_id.write(pool_id + 1);
            self.emit(Event::PoolCreated(PoolCreated { pool_id, creator: get_caller_address() }));
            pool_id
        }

        fn contribute(ref self: ContractState, pool_id: u64, amount: u256) {
            let caller = get_caller_address();
            let is_complete = self.pool_is_complete.read(pool_id);
            assert!(!is_complete, "POOL_COMPLETE");
            // Transfer STRK from caller to this contract
            let strk_addr: ContractAddress = STRK_CONTRACT.try_into().unwrap();
            let strk = IERC20Dispatcher { contract_address: strk_addr };
            strk.transfer_from(caller, get_contract_address(), amount);
            // Update contribution
            let prev = self.contributions.entry(pool_id).entry(caller).read();
            self.contributions.entry(pool_id).entry(caller).write(prev + amount);
            let prev_total = self.pool_total_contributed.read(pool_id);
            self.pool_total_contributed.write(pool_id, prev_total + amount);
            self.emit(Event::Contributed(Contributed { pool_id, contributor: caller, amount }));
        }

        fn get_pool(self: @ContractState, pool_id: u64) -> (ByteArray, u256, ContractAddress, u256, bool) {
            let description = self.pool_description.read(pool_id);
            let target_amount = self.pool_target_amount.read(pool_id);
            let recipient = self.pool_recipient.read(pool_id);
            let total_contributed = self.pool_total_contributed.read(pool_id);
            let is_complete = self.pool_is_complete.read(pool_id);
            (description, target_amount, recipient, total_contributed, is_complete)
        }

        fn get_contribution(self: @ContractState, pool_id: u64, user: ContractAddress) -> u256 {
            self.contributions.entry(pool_id).entry(user).read()
        }

        fn mark_complete(ref self: ContractState, pool_id: u64) {
            let is_complete = self.pool_is_complete.read(pool_id);
            assert!(!is_complete, "ALREADY_COMPLETE");
            let total_contributed = self.pool_total_contributed.read(pool_id);
            let target_amount = self.pool_target_amount.read(pool_id);
            assert!(total_contributed >= target_amount, "TARGET_NOT_MET");
            self.pool_is_complete.write(pool_id, true);
            self.emit(Event::PoolCompleted(PoolCompleted { pool_id }));
        }

        fn withdraw(ref self: ContractState, pool_id: u64) {
            let caller = get_caller_address();
            let is_complete = self.pool_is_complete.read(pool_id);
            assert!(is_complete, "NOT_COMPLETE");
            let recipient = self.pool_recipient.read(pool_id);
            assert!(caller == recipient, "NOT_RECIPIENT");
            let amount = self.pool_total_contributed.read(pool_id);
            let strk_addr: ContractAddress = STRK_CONTRACT.try_into().unwrap();
            let strk = IERC20Dispatcher { contract_address: strk_addr };
            strk.transfer(recipient, amount);
            self.pool_total_contributed.write(pool_id, 0);
            self.emit(Event::Withdrawn(Withdrawn { pool_id, recipient, amount }));
        }
    }
}
