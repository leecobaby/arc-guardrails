"use client";

import { ChevronDown, ExternalLink, LoaderCircle, Wallet, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

type WalletConnectProps = { chainId: number };

const shortAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

export function WalletConnect({ chainId }: WalletConnectProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const { address, connector: activeConnector, isConnected } = useAccount();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const walletOptions = useMemo(() => {
    const discoveredMetaMask = connectors.find(
      (connector) =>
        connector.id === "metaMaskSDK" ||
        connector.id === "io.metamask" ||
        connector.name === "MetaMask",
    );
    const others = connectors.filter(
      (connector) =>
        connector !== discoveredMetaMask &&
        connector.id !== "metaMaskSDK" &&
        connector.id !== "io.metamask" &&
        connector.name !== "MetaMask",
    );
    return discoveredMetaMask ? [discoveredMetaMask, ...others] : others;
  }, [connectors]);

  async function chooseWallet(connector: (typeof connectors)[number]) {
    setError(undefined);
    try {
      await connectAsync({ connector, chainId });
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message.split("\n")[0] : "Connection failed.",
      );
    }
  }

  return (
    <>
      <button
        type="button"
        className={`wallet-button${isConnected ? " connected" : ""}`}
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Wallet size={16} />
        {isConnected && address ? shortAddress(address) : "Connect wallet"}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div
          className="wallet-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="wallet-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-dialog-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
          >
            <div className="wallet-dialog-heading">
              <h2 id="wallet-dialog-title">
                {isConnected ? "Connected wallet" : "Choose a wallet"}
              </h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setOpen(false)}
                title="Close wallet dialog"
                aria-label="Close wallet dialog"
              >
                <X size={17} />
              </button>
            </div>

            {isConnected && address ? (
              <>
                <div className="wallet-account">
                  <strong>{activeConnector?.name ?? "Browser wallet"}</strong>
                  <span>{address}</span>
                </div>
                <button
                  type="button"
                  className="wallet-option"
                  onClick={() => {
                    disconnect();
                    setOpen(false);
                  }}
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <div className="wallet-options">
                  {walletOptions.map((connector) => (
                    <button
                      type="button"
                      className="wallet-option"
                      key={connector.uid}
                      disabled={isPending}
                      onClick={() => void chooseWallet(connector)}
                    >
                      <Wallet size={17} />
                      <span>
                        {connector.id === "injected"
                          ? "Browser wallet (default)"
                          : connector.name}
                      </span>
                      {isPending && <LoaderCircle size={15} className="spin" />}
                    </button>
                  ))}
                </div>
                {error && <p className="wallet-error" role="alert">{error}</p>}
                <a
                  className="wallet-install"
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Get MetaMask <ExternalLink size={14} />
                </a>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
