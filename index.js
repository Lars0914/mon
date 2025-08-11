require("dotenv").config();
const express = require("express");
const app = express();
app.use(express.json());
app.post("/api/webhook", async (req, res) => {
  try {
    const body = req.body;
    const messages = [];
    if (body.chainId) {
      const { chainId, txs = [], erc20Transfers = [] } = body;

      const isEthereum = chainId === "0x1";
      const chainName = isEthereum ? "Ethereum" : "BSC";
      const explorerUrl = isEthereum
        ? "https://etherscan.io/tx/"
        : "https://bscscan.com/tx/";
      const usdtContract = isEthereum
        ? "0xdac17f958d2ee523a2206206994597c13d831ec7"
        : "0x55d398326f99059ff775485246999027b3197955";

      for (const tx of txs) {
        const valueWei = BigInt(tx.value || "0");
        if (valueWei > 0n) {
          const txId = tx.hash;
          const amount = (Number(valueWei) / 1e18).toFixed(6);
          messages.push(
            `Amount: ${amount} "\n"  On ${chainName}: ${explorerUrl}${txId}`
          );
        }
      }

      for (const transfer of erc20Transfers) {
        if (transfer.contract.toLowerCase() === usdtContract) {
          const amount = parseFloat(transfer.valueWithDecimals).toFixed(6);
          const monitoredWallets = [
            "0x72aCC3bc7FFfcB6C773FCc2184293B923c7213Cc",
          ].map((w) => w.toLowerCase());
          if (
            monitoredWallets.includes(transfer.to.toLowerCase()) &&
            amount != 0
          ) {
            const txId = transfer.transactionHash;
            messages.push(
              `Amount: ${amount} "\n"  On ${chainName}: ${explorerUrl}${txId}`
            );
            messages.push(
              `Transaction ID: ${txId} on ${chainName}: ${explorerUrl}${txId}`
            );
          }
        }
      }
    } else if (body.chain && body.chain.toLowerCase().startsWith("tron")) {
      const { amount, txId, subscriptionType, chain, tokenId, type, address } =
        body;
        
      if (parseFloat(amount) <= 0) {
        return res.status(200).json({ success: true });
      }

      const chainName = "TRON";
      const explorerUrl = chain.toLowerCase().includes("testnet")
        ? "https://nile.tronscan.org/#/transaction/"
        : "https://tronscan.org/#/transaction/";
      const usdtContract = "tr7nhqjekqxgtci8q8zy4pl8otszgjlj6t";

      if (
        subscriptionType === "INCOMING_INTERNAL_TX" ||
        (subscriptionType === "ADDRESS_EVENT" &&
          ((type === "native" && body.asset === "TRON") ||
            (type === "token" &&
              tokenId &&
              tokenId.toLowerCase() === usdtContract)))
      ) {
        const monitoredWallets = ["TARUvN2dXwXPJnujKJnRC76Po6ndF4WtPv"].map(
          (w) => w.toLowerCase()
        );
        if (monitoredWallets.includes(address.toLowerCase())) {
          messages.push(
            `Transaction ID: ${txId} on ${chainName}: ${explorerUrl}${txId}`
          );
        }
      }
    } else {
      return res.status(200).json({ success: true });
    }

    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (!telegramToken || !telegramChatId) {
      console.error("Missing Telegram env vars");
      return res.status(200).json({ success: true });
    }

    for (const msg of messages) {
      const url = `https://api.telegram.org/bot${telegramToken}/sendMessage?chat_id=${telegramChatId}&text=${encodeURIComponent(
        msg
      )}`;
      await fetch(url);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(200).json({ success: true });
  }
});

app.get("/", (req, res) => {
  res.send("Server is running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
