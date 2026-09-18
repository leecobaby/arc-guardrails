"use client";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  CircleDollarSign,
  Clock3,
  Copy,
  ExternalLink,
  Gauge,
  Landmark,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Pause,
  Play,
  Settings2,
  ShieldCheck,
  UserRoundCog,
  Wallet,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import {
  Address,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  keccak256,
  parseUnits,
  stringToHex,
  zeroAddress,
} from "viem";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
} from "wagmi";

import {
  ARC_USDC_ADDRESS,
  arc,
  arcTestnet,
  explorerUrl,
} from "@/lib/arc";
import { arcGuardVaultAbi } from "@/lib/contracts";

type Panel = "fund" | "policy" | "recipient" | "pay" | "owner";
type Notice = {
  kind: "success" | "error" | "pending";
  text: string;
  hash?: string;
};
type SpendRow = {
  hash: string;
  recipient: Address;
  amount: bigint;
  paymentId: string;
  blockNumber: bigint;
};

const previewRows: SpendRow[] = [
  {
    hash: "0xpreview-research",
    recipient: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
    amount: 120_000n,
    paymentId: "research-api-042",
    blockNumber: 18_240_118n,
  },
  {
    hash: "0xpreview-indexing",
    recipient: "0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF",
    amount: 80_000n,
    paymentId: "indexer-042",
    blockNumber: 18_240_004n,
  },
  {
    hash: "0xpreview-storage",
    recipient: "0x6813Eb9362372EEF6200f3b1dbC3f819671cBA69",
    amount: 50_000n,
    paymentId: "storage-041",
    blockNumber: 18_237_901n,
  },
];

const short = (value?: string, leading = 6, trailing = 4) =>
  value ? `${value.slice(0, leading)}…${value.slice(-trailing)}` : "Not set";

const formatUsdc = (value?: bigint) =>
  Number(formatUnits(value ?? 0n, 6)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function configuredAddress(chainId: number): Address | undefined {
  const candidate =
    chainId === arc.id
      ? process.env.NEXT_PUBLIC_MAINNET_VAULT_ADDRESS
      : process.env.NEXT_PUBLIC_TESTNET_VAULT_ADDRESS;
  return candidate && isAddress(candidate) ? getAddress(candidate) : undefined;
}

export function Dashboard() {
  const connectedChainId = useChainId();
  const [selectedChainId, setSelectedChainId] = useState<number>(arcTestnet.id);
  const [activePanel, setActivePanel] = useState<Panel>("fund");
  const [notice, setNotice] = useState<Notice>();
  const [copied, setCopied] = useState(false);

  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const chain = selectedChainId === arc.id ? arc : arcTestnet;
  const vaultAddress = configuredAddress(selectedChainId);
  const readVaultAddress = vaultAddress ?? zeroAddress;
  const isPreview = !vaultAddress;
  const publicClient = usePublicClient({ chainId: selectedChainId });

  const contracts = useMemo(() => {
    return [
      {
        address: readVaultAddress,
        abi: arcGuardVaultAbi,
        functionName: "owner",
        chainId: selectedChainId,
      },
      {
        address: readVaultAddress,
        abi: arcGuardVaultAbi,
        functionName: "pendingOwner",
        chainId: selectedChainId,
      },
      {
        address: readVaultAddress,
        abi: arcGuardVaultAbi,
        functionName: "agent",
        chainId: selectedChainId,
      },
      {
        address: readVaultAddress,
        abi: arcGuardVaultAbi,
        functionName: "paused",
        chainId: selectedChainId,
      },
      {
        address: readVaultAddress,
        abi: arcGuardVaultAbi,
        functionName: "policy",
        chainId: selectedChainId,
      },
      {
        address: readVaultAddress,
        abi: arcGuardVaultAbi,
        functionName: "currentDayState",
        chainId: selectedChainId,
      },
      {
        address: ARC_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [readVaultAddress],
        chainId: selectedChainId,
      },
    ] as const;
  }, [readVaultAddress, selectedChainId]);

  const { data: reads, refetch } = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: Boolean(vaultAddress), refetchInterval: 12_000 },
  });

  const owner = reads?.[0]?.result as Address | undefined;
  const pendingOwner = reads?.[1]?.result as Address | undefined;
  const agent = reads?.[2]?.result as Address | undefined;
  const paused = (reads?.[3]?.result as boolean | undefined) ?? false;
  const policy = reads?.[4]?.result as
    | readonly [bigint, bigint, bigint, boolean]
    | undefined;
  const dayState = reads?.[5]?.result as
    | readonly [bigint, bigint, bigint]
    | undefined;
  const vaultBalance = (reads?.[6]?.result as bigint | undefined) ?? 0n;

  const displayBalance = isPreview ? 12_450_000n : vaultBalance;
  const displaySpent = isPreview ? 250_000n : dayState?.[1] ?? 0n;
  const displayRemaining = isPreview ? 1_750_000n : dayState?.[2] ?? 0n;
  const displayPerTx = isPreview ? 500_000n : policy?.[0] ?? 0n;
  const displayDaily = isPreview ? 2_000_000n : policy?.[1] ?? 0n;

  const { data: activities = [], refetch: refetchActivities } = useQuery({
    queryKey: ["vault-activity", selectedChainId, vaultAddress],
    enabled: Boolean(vaultAddress && publicClient),
    refetchInterval: 12_000,
    queryFn: async (): Promise<SpendRow[]> => {
      if (!vaultAddress || !publicClient) return [];
      const latest = await publicClient.getBlockNumber();
      const fromBlock = latest > 50_000n ? latest - 50_000n : 0n;
      const logs = await publicClient.getContractEvents({
        address: vaultAddress,
        abi: arcGuardVaultAbi,
        eventName: "Spent",
        fromBlock,
        toBlock: "latest",
        strict: true,
      });
      return logs
        .slice(-12)
        .reverse()
        .map((log) => ({
          hash: log.transactionHash,
          recipient: log.args.recipient,
          amount: log.args.amount,
          paymentId: log.args.paymentId,
          blockNumber: log.blockNumber,
        }));
    },
  });

  async function selectNetwork(chainId: number) {
    setSelectedChainId(chainId);
    if (isConnected && connectedChainId !== chainId) {
      try {
        await switchChainAsync({ chainId });
      } catch {
        setNotice({ kind: "error", text: "Network switch was cancelled." });
      }
    }
  }

  async function settle(hash: `0x${string}`, label: string) {
    setNotice({ kind: "pending", text: `${label} is confirming…`, hash });
    if (!publicClient) throw new Error("Public client unavailable");
    await publicClient.waitForTransactionReceipt({ hash });
    setNotice({ kind: "success", text: `${label} confirmed.`, hash });
    await Promise.all([refetch(), refetchActivities()]);
  }

  function requireWriteAccess() {
    if (!isConnected) throw new Error("Connect a wallet first.");
    if (!vaultAddress) {
      throw new Error("No vault is configured for this network.");
    }
    if (connectedChainId !== selectedChainId) {
      throw new Error(`Switch to ${chain.name} first.`);
    }
    return vaultAddress;
  }

  async function execute(task: () => Promise<void>) {
    setNotice(undefined);
    try {
      await task();
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message.split("\n")[0]
            : "Transaction failed.",
      });
    }
  }

  async function handleFund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await execute(async () => {
      const vault = requireWriteAccess();
      const amount = parseUnits(String(form.get("amount")), 6);
      const approvalHash = await writeContractAsync({
        address: ARC_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [vault, amount],
        chainId: selectedChainId,
      });
      await settle(approvalHash, "USDC approval");
      const depositHash = await writeContractAsync({
        address: vault,
        abi: arcGuardVaultAbi,
        functionName: "deposit",
        args: [amount],
        chainId: selectedChainId,
      });
      await settle(depositHash, "Vault funding");
      formElement.reset();
    });
  }

  async function handlePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await execute(async () => {
      const vault = requireWriteAccess();
      const nextAgent = String(form.get("agent"));
      if (!isAddress(nextAgent)) throw new Error("Enter a valid agent address.");
      const perTx = parseUnits(String(form.get("perTx")), 6);
      const daily = parseUnits(String(form.get("daily")), 6);
      const hours = Number(form.get("hours"));
      const expiresAt =
        hours > 0
          ? BigInt(Math.floor(Date.now() / 1000) + hours * 3600)
          : 0n;
      const allowlistOnly = form.get("allowlist") === "on";

      if (!agent || agent.toLowerCase() !== nextAgent.toLowerCase()) {
        const agentHash = await writeContractAsync({
          address: vault,
          abi: arcGuardVaultAbi,
          functionName: "setAgent",
          args: [getAddress(nextAgent)],
          chainId: selectedChainId,
        });
        await settle(agentHash, "Agent update");
      }
      const policyHash = await writeContractAsync({
        address: vault,
        abi: arcGuardVaultAbi,
        functionName: "setPolicy",
        args: [perTx, daily, expiresAt, allowlistOnly],
        chainId: selectedChainId,
      });
      await settle(policyHash, "Policy update");
    });
  }

  async function handleRecipient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await execute(async () => {
      const vault = requireWriteAccess();
      const recipient = String(form.get("recipient"));
      if (!isAddress(recipient)) {
        throw new Error("Enter a valid recipient address.");
      }
      const allowed = form.get("allowed") === "on";
      const hash = await writeContractAsync({
        address: vault,
        abi: arcGuardVaultAbi,
        functionName: "setRecipient",
        args: [getAddress(recipient), allowed],
        chainId: selectedChainId,
      });
      await settle(hash, allowed ? "Recipient approved" : "Recipient removed");
    });
  }

  async function handlePay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await execute(async () => {
      const vault = requireWriteAccess();
      const recipient = String(form.get("recipient"));
      const invoice = String(form.get("invoice")).trim();
      if (!isAddress(recipient)) {
        throw new Error("Enter a valid recipient address.");
      }
      if (!invoice) throw new Error("Invoice reference is required.");
      const amount = parseUnits(String(form.get("amount")), 6);
      const paymentId = keccak256(stringToHex(invoice));
      const hash = await writeContractAsync({
        address: vault,
        abi: arcGuardVaultAbi,
        functionName: "spend",
        args: [getAddress(recipient), amount, paymentId],
        chainId: selectedChainId,
      });
      await settle(hash, "Agent payment");
    });
  }

  async function handleOwnership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await execute(async () => {
      const vault = requireWriteAccess();
      const nextOwner = String(form.get("owner"));
      if (!isAddress(nextOwner)) {
        throw new Error("Enter a valid owner address.");
      }
      const hash = await writeContractAsync({
        address: vault,
        abi: arcGuardVaultAbi,
        functionName: "transferOwnership",
        args: [getAddress(nextOwner)],
        chainId: selectedChainId,
      });
      await settle(hash, "Ownership transfer initiated");
    });
  }

  async function togglePause() {
    await execute(async () => {
      const vault = requireWriteAccess();
      const hash = await writeContractAsync({
        address: vault,
        abi: arcGuardVaultAbi,
        functionName: paused ? "unpause" : "pause",
        chainId: selectedChainId,
      });
      await settle(hash, paused ? "Vault resumed" : "Vault paused");
    });
  }

  async function copyVault() {
    if (!vaultAddress) return;
    await navigator.clipboard.writeText(vaultAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  const rows = isPreview ? previewRows : activities;
  const isOwner = Boolean(
    address && owner && address.toLowerCase() === owner.toLowerCase(),
  );
  const isAgent = Boolean(
    address && agent && address.toLowerCase() === agent.toLowerCase(),
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <ShieldCheck size={19} strokeWidth={2.2} />
          </div>
          <div>
            <strong>Arc Guardrails</strong>
            <span>USDC policy vault</span>
          </div>
        </div>
        <nav className="side-nav" aria-label="Workspace">
          <a href="#overview" className="active">
            <Gauge size={17} /> Overview
          </a>
          <a href="#activity">
            <Activity size={17} /> Activity
          </a>
          <a href="#controls">
            <Settings2 size={17} /> Controls
          </a>
        </nav>
        <div className="sidebar-foot">
          <span className="network-dot" />
          <div>
            <strong>{chain.name}</strong>
            <span>Chain ID {chain.id}</span>
          </div>
        </div>
      </aside>

      <main className="workspace" id="overview">
        <header className="topbar">
          <div>
            <p className="eyebrow">Autonomous treasury</p>
            <h1>Operations console</h1>
          </div>
          <div className="topbar-actions">
            <div className="segment" aria-label="Network">
              <button
                className={selectedChainId === arcTestnet.id ? "selected" : ""}
                onClick={() => void selectNetwork(arcTestnet.id)}
                disabled={isSwitching}
              >
                Testnet
              </button>
              <button
                className={selectedChainId === arc.id ? "selected" : ""}
                onClick={() => void selectNetwork(arc.id)}
                disabled={isSwitching}
              >
                Mainnet
              </button>
            </div>
            {isConnected ? (
              <button
                className="wallet-button connected"
                onClick={() => disconnect()}
              >
                <span className="wallet-led" /> {short(address)}
              </button>
            ) : (
              <button
                className="wallet-button"
                onClick={() => connect({ connector: connectors[0] })}
                disabled={isConnecting || !connectors[0]}
              >
                <Wallet size={16} />
                {isConnecting ? "Connecting" : "Connect wallet"}
              </button>
            )}
          </div>
        </header>

        <section className="status-strip">
          <div className="contract-identity">
            <div className="status-icon">
              <Landmark size={20} />
            </div>
            <div>
              <span>Vault contract</span>
              <strong>
                {vaultAddress ? short(vaultAddress, 10, 8) : "Preview workspace"}
              </strong>
            </div>
            {vaultAddress && (
              <button
                className="icon-button"
                onClick={() => void copyVault()}
                title="Copy vault address"
                aria-label="Copy vault address"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            )}
          </div>
          <div className={`status-pill ${paused ? "danger" : "healthy"}`}>
            <span />
            {isPreview ? "Preview" : paused ? "Paused" : "Policy active"}
          </div>
          {vaultAddress && (
            <a
              className="quiet-link"
              href={explorerUrl(selectedChainId, "address", vaultAddress)}
              target="_blank"
              rel="noreferrer"
            >
              Explorer <ExternalLink size={14} />
            </a>
          )}
        </section>

        <section className="metrics" aria-label="Vault metrics">
          <Metric
            icon={<CircleDollarSign size={16} />}
            label="Vault balance"
            value={formatUsdc(displayBalance)}
            detail="USDC available"
          />
          <Metric
            icon={<Activity size={16} />}
            label="Spent today"
            value={formatUsdc(displaySpent)}
            detail={`${formatUsdc(displayRemaining)} remaining`}
          />
          <Metric
            icon={<LockKeyhole size={16} />}
            label="Per transaction"
            value={formatUsdc(displayPerTx)}
            detail={`${formatUsdc(displayDaily)} daily cap`}
          />
          <Metric
            icon={<Bot size={16} />}
            label="Active agent"
            value={isPreview ? "0x71C4…976F" : short(agent)}
            detail={isAgent ? "Connected as agent" : "Policy executor"}
            mono
          />
        </section>

        <div className="content-grid">
          <section className="ledger" id="activity">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Payment ledger</p>
                <h2>Recent agent activity</h2>
              </div>
              <div className="legend">
                <span className="network-dot" /> Deterministic finality
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Recipient</th>
                    <th>Amount</th>
                    <th>Block</th>
                    <th aria-label="Explorer" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-row">
                        No agent payments in the indexed window.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={`${row.hash}-${row.paymentId}`}>
                        <td>
                          <div className="payment-cell">
                            <span className="payment-icon">
                              <ArrowRight size={15} />
                            </span>
                            <div>
                              <strong>
                                {row.paymentId.startsWith("0x")
                                  ? short(row.paymentId, 8, 6)
                                  : row.paymentId}
                              </strong>
                              <span>
                                {row.hash.startsWith("0xpreview")
                                  ? "Preview record"
                                  : short(row.hash, 8, 6)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="mono">{short(row.recipient)}</td>
                        <td className="amount">
                          {formatUsdc(row.amount)} USDC
                        </td>
                        <td className="mono">#{row.blockNumber.toString()}</td>
                        <td>
                          {!row.hash.startsWith("0xpreview") && (
                            <a
                              className="icon-button"
                              href={explorerUrl(selectedChainId, "tx", row.hash)}
                              target="_blank"
                              rel="noreferrer"
                              title="Open transaction"
                              aria-label="Open transaction"
                            >
                              <ArrowUpRight size={15} />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="policy-band">
              <div>
                <span className="policy-icon">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <strong>Contract-enforced policy</strong>
                  <p>Every payment is checked before USDC leaves the vault.</p>
                </div>
              </div>
              <div className="policy-facts">
                <span>
                  Allowlist <strong>{isPreview || policy?.[3] ? "On" : "Off"}</strong>
                </span>
                <span>
                  Expiry{" "}
                  <strong>
                    {isPreview
                      ? "24h"
                      : policy?.[2]
                        ? new Date(Number(policy[2]) * 1000).toLocaleDateString()
                        : "None"}
                  </strong>
                </span>
              </div>
            </div>
          </section>

          <aside className="control-panel" id="controls">
            <div className="control-title">
              <div>
                <p className="eyebrow">Execution</p>
                <h2>Vault controls</h2>
              </div>
              <button
                className={`icon-button ${paused ? "resume" : ""}`}
                onClick={() => void togglePause()}
                disabled={!isOwner || isPreview}
                title={paused ? "Resume vault" : "Pause vault"}
                aria-label={paused ? "Resume vault" : "Pause vault"}
              >
                {paused ? <Play size={16} /> : <Pause size={16} />}
              </button>
            </div>
            <div className="control-tabs" role="tablist" aria-label="Vault actions">
              {(
                [
                  ["fund", "Fund"],
                  ["policy", "Policy"],
                  ["recipient", "Access"],
                  ["pay", "Pay"],
                  ["owner", "Owner"],
                ] as [Panel, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={activePanel === key ? "active" : ""}
                  onClick={() => setActivePanel(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="form-body">
              {activePanel === "fund" && (
                <form onSubmit={(event) => void handleFund(event)}>
                  <FormIntro
                    icon={<CircleDollarSign size={18} />}
                    title="Fund the vault"
                    detail="Approve and deposit Arc USDC."
                  />
                  <Field
                    label="Amount"
                    name="amount"
                    type="number"
                    placeholder="10.00"
                    suffix="USDC"
                    step="0.000001"
                    min="0.000001"
                    required
                  />
                  <SubmitButton
                    label="Approve & deposit"
                    disabled={!isConnected || isPreview}
                  />
                </form>
              )}
              {activePanel === "policy" && (
                <form onSubmit={(event) => void handlePolicy(event)}>
                  <FormIntro
                    icon={<Gauge size={18} />}
                    title="Spending policy"
                    detail="Set the agent and contract limits."
                  />
                  <Field
                    label="Agent address"
                    name="agent"
                    placeholder={agent ?? "0x…"}
                    defaultValue={agent ?? ""}
                    required
                  />
                  <div className="field-pair">
                    <Field
                      label="Per transaction"
                      name="perTx"
                      type="number"
                      defaultValue={policy ? formatUnits(policy[0], 6) : "0.50"}
                      step="0.000001"
                      min="0.000001"
                      required
                    />
                    <Field
                      label="Daily limit"
                      name="daily"
                      type="number"
                      defaultValue={policy ? formatUnits(policy[1], 6) : "2.00"}
                      step="0.000001"
                      min="0.000001"
                      required
                    />
                  </div>
                  <Field
                    label="Expires after"
                    name="hours"
                    type="number"
                    defaultValue="24"
                    suffix="hours"
                    min="0"
                  />
                  <label className="check-row">
                    <input
                      type="checkbox"
                      name="allowlist"
                      defaultChecked={policy?.[3] ?? true}
                    />
                    <span><Check size={13} /></span>
                    Restrict to approved recipients
                  </label>
                  <SubmitButton label="Save policy" disabled={!isOwner || isPreview} />
                </form>
              )}
              {activePanel === "recipient" && (
                <form onSubmit={(event) => void handleRecipient(event)}>
                  <FormIntro
                    icon={<Link2 size={18} />}
                    title="Recipient access"
                    detail="Add or remove approved payees."
                  />
                  <Field
                    label="Recipient address"
                    name="recipient"
                    placeholder="0x…"
                    required
                  />
                  <label className="check-row">
                    <input type="checkbox" name="allowed" defaultChecked />
                    <span><Check size={13} /></span>
                    Recipient may receive funds
                  </label>
                  <SubmitButton
                    label="Update access"
                    disabled={!isOwner || isPreview}
                  />
                </form>
              )}
              {activePanel === "pay" && (
                <form onSubmit={(event) => void handlePay(event)}>
                  <FormIntro
                    icon={<Bot size={18} />}
                    title="Agent payment"
                    detail="Execute a replay-safe USDC payment."
                  />
                  <Field
                    label="Recipient"
                    name="recipient"
                    placeholder="0x…"
                    required
                  />
                  <div className="field-pair">
                    <Field
                      label="Amount"
                      name="amount"
                      type="number"
                      placeholder="0.10"
                      step="0.000001"
                      min="0.000001"
                      required
                    />
                    <Field
                      label="Invoice reference"
                      name="invoice"
                      placeholder="api-job-042"
                      required
                    />
                  </div>
                  <SubmitButton
                    label="Execute payment"
                    disabled={!isAgent || isPreview}
                  />
                </form>
              )}
              {activePanel === "owner" && (
                <form onSubmit={(event) => void handleOwnership(event)}>
                  <FormIntro
                    icon={<UserRoundCog size={18} />}
                    title="Transfer control"
                    detail="The new owner must accept onchain."
                  />
                  <div className="ownership-current">
                    <span>Current owner</span>
                    <strong>{isPreview ? "0xF39F…2266" : short(owner)}</strong>
                  </div>
                  {pendingOwner &&
                    pendingOwner !== "0x0000000000000000000000000000000000000000" && (
                      <div className="pending-owner">
                        <Clock3 size={14} /> Pending {short(pendingOwner)}
                      </div>
                    )}
                  <Field
                    label="New owner"
                    name="owner"
                    placeholder="0x…"
                    required
                  />
                  <SubmitButton
                    label="Begin two-step transfer"
                    disabled={!isOwner || isPreview}
                  />
                </form>
              )}
            </div>

            {notice && (
              <div className={`notice ${notice.kind}`}>
                {notice.kind === "pending" ? (
                  <LoaderCircle className="spin" size={16} />
                ) : notice.kind === "success" ? (
                  <Check size={16} />
                ) : (
                  <span className="notice-mark">!</span>
                )}
                <span>{notice.text}</span>
                {notice.hash && (
                  <a
                    href={explorerUrl(selectedChainId, "tx", notice.hash)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open transaction"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            )}
            <div className="role-line">
              <span>
                {isOwner
                  ? "Owner access"
                  : isAgent
                    ? "Agent access"
                    : "Read-only access"}
              </span>
              <strong>{isPreview ? "Preview" : "Onchain"}</strong>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  mono?: boolean;
}) {
  return (
    <article>
      <div className="metric-label">{icon}{label}</div>
      <strong className={mono ? "metric-address" : undefined}>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function FormIntro({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="form-intro">
      <span>{icon}</span>
      <div><strong>{title}</strong><p>{detail}</p></div>
    </div>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  suffix?: string;
};

function Field({ label, suffix, ...props }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>
        <input {...props} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <button className="primary-button" type="submit" disabled={disabled}>
      {label}<ArrowRight size={16} />
    </button>
  );
}
