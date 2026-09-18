import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { keccak256, stringToHex } from "viem";

describe("ArcGuardVault", async function () {
  const { viem, networkHelpers } = await network.create();
  const [owner, agent, recipient, outsider, newOwner] =
    await viem.getWalletClients();

  const usdc = (value: number) => BigInt(value) * 1_000_000n;

  async function deployVaultFixture() {
    const token = await viem.deployContract("MockUSDC");
    const vault = await viem.deployContract("ArcGuardVault", [
      owner.account.address,
      token.address,
    ]);

    await token.write.mint([owner.account.address, usdc(1_000)]);
    await token.write.approve([vault.address, usdc(1_000)]);
    await vault.write.deposit([usdc(1_000)]);
    await vault.write.setAgent([agent.account.address]);
    await vault.write.setRecipient([recipient.account.address, true]);
    await vault.write.setPolicy([usdc(25), usdc(100), 0n, true]);

    return { token, vault };
  }

  it("funds the vault and executes an allowlisted agent payment", async function () {
    const { token, vault } = await networkHelpers.loadFixture(
      deployVaultFixture,
    );
    const paymentId = keccak256(stringToHex("invoice-001"));

    await viem.assertions.emitWithArgs(
      vault.write.spend(
        [recipient.account.address, usdc(12), paymentId],
        { account: agent.account },
      ),
      vault,
      "Spent",
      [
        agent.account.address,
        recipient.account.address,
        usdc(12),
        paymentId,
        (value: bigint) => value > 0n,
      ],
    );

    assert.equal(
      await token.read.balanceOf([recipient.account.address]),
      usdc(12),
    );
    assert.equal(await vault.read.usedPaymentIds([paymentId]), true);
    const [, spent, remaining] = await vault.read.currentDayState();
    assert.equal(spent, usdc(12));
    assert.equal(remaining, usdc(88));
  });

  it("rejects unauthorized callers, unlisted recipients, and replayed ids", async function () {
    const { vault } = await networkHelpers.loadFixture(deployVaultFixture);
    const paymentId = keccak256(stringToHex("invoice-002"));

    await viem.assertions.revertWithCustomError(
      vault.write.spend(
        [recipient.account.address, usdc(1), paymentId],
        { account: outsider.account },
      ),
      vault,
      "UnauthorizedAgent",
    );

    await viem.assertions.revertWithCustomError(
      vault.write.spend(
        [outsider.account.address, usdc(1), paymentId],
        { account: agent.account },
      ),
      vault,
      "RecipientNotAllowed",
    );

    await vault.write.spend(
      [recipient.account.address, usdc(1), paymentId],
      { account: agent.account },
    );
    await viem.assertions.revertWithCustomError(
      vault.write.spend(
        [recipient.account.address, usdc(1), paymentId],
        { account: agent.account },
      ),
      vault,
      "PaymentIdAlreadyUsed",
    );
  });

  it("enforces per-transaction and UTC daily limits, then resets next day", async function () {
    const { vault } = await networkHelpers.loadFixture(deployVaultFixture);

    await viem.assertions.revertWithCustomError(
      vault.write.spend(
        [
          recipient.account.address,
          usdc(26),
          keccak256(stringToHex("too-large")),
        ],
        { account: agent.account },
      ),
      vault,
      "TransactionLimitExceeded",
    );

    for (let index = 0; index < 4; index += 1) {
      await vault.write.spend(
        [
          recipient.account.address,
          usdc(25),
          keccak256(stringToHex(`daily-${index}`)),
        ],
        { account: agent.account },
      );
    }

    await viem.assertions.revertWithCustomError(
      vault.write.spend(
        [recipient.account.address, usdc(1), keccak256(stringToHex("overflow"))],
        { account: agent.account },
      ),
      vault,
      "DailyLimitExceeded",
    );

    const now = await networkHelpers.time.latest();
    const nextDay = Math.floor(now / 86_400) * 86_400 + 86_401;
    await networkHelpers.time.increaseTo(nextDay);

    await vault.write.spend(
      [recipient.account.address, usdc(1), keccak256(stringToHex("next-day"))],
      { account: agent.account },
    );
    const [, spent] = await vault.read.currentDayState();
    assert.equal(spent, usdc(1));
  });

  it("blocks expired and paused policies while preserving emergency withdrawal", async function () {
    const { token, vault } = await networkHelpers.loadFixture(
      deployVaultFixture,
    );
    const now = await networkHelpers.time.latest();
    await vault.write.setPolicy([usdc(25), usdc(100), BigInt(now + 60), true]);
    await networkHelpers.time.increaseTo(now + 61);

    await viem.assertions.revertWithCustomError(
      vault.write.spend(
        [recipient.account.address, usdc(1), keccak256(stringToHex("expired"))],
        { account: agent.account },
      ),
      vault,
      "PolicyExpired",
    );

    await vault.write.pause();
    await viem.assertions.revertWithCustomError(
      vault.write.spend(
        [recipient.account.address, usdc(1), keccak256(stringToHex("paused"))],
        { account: agent.account },
      ),
      vault,
      "EnforcedPause",
    );

    await vault.write.withdraw([owner.account.address, usdc(10)]);
    assert.equal(await token.read.balanceOf([owner.account.address]), usdc(10));
  });

  it("rotates the agent and completes two-step ownership transfer", async function () {
    const { vault } = await networkHelpers.loadFixture(deployVaultFixture);

    await vault.write.setAgent([outsider.account.address]);
    await viem.assertions.revertWithCustomError(
      vault.write.spend(
        [recipient.account.address, usdc(1), keccak256(stringToHex("old-agent"))],
        { account: agent.account },
      ),
      vault,
      "UnauthorizedAgent",
    );

    await vault.write.transferOwnership([newOwner.account.address]);
    assert.equal(
      (await vault.read.owner()).toLowerCase(),
      owner.account.address.toLowerCase(),
    );
    assert.equal(
      (await vault.read.pendingOwner()).toLowerCase(),
      newOwner.account.address.toLowerCase(),
    );

    await viem.assertions.revertWithCustomError(
      vault.write.acceptOwnership({ account: outsider.account }),
      vault,
      "OwnableUnauthorizedAccount",
    );
    await vault.write.acceptOwnership({ account: newOwner.account });
    assert.equal(
      (await vault.read.owner()).toLowerCase(),
      newOwner.account.address.toLowerCase(),
    );

    await viem.assertions.revertWithCustomError(
      vault.write.renounceOwnership({ account: newOwner.account }),
      vault,
      "RenounceOwnershipDisabled",
    );
  });
});
