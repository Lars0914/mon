require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());

// Webhook endpoint (supports Moralis for EVM and Tatum for TRON)
app.post("/api/webhook", async (req, res) => {
  try {
    const body = req.body;

    const messages = [];

    // Detect and process Moralis payload (EVM: BSC/Ethereum)
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

      // Native transfers
      for (const tx of txs) {
        const valueWei = BigInt(tx.value || "0");
        const amount = (Number(valueWei) / 1e18).toFixed(6);
        if (valueWei > 0n && amount != 0) {
          const txId = tx.hash;
          messages.push(
            `Amount: ${amount} "\n"  On ${chainName}: ${explorerUrl}${txId}`
          );
        }
      }

      // USDT transfers (ERC20/BEP20)
      for (const transfer of erc20Transfers) {
        const amount = parseFloat(transfer.valueWithDecimals).toFixed(6);
        if (transfer.contract.toLowerCase() === usdtContract && amount != 0) {
          const txId = transfer.transactionHash;
          messages.push(
            `Amount: ${amount} "\n"  On ${chainName}: ${explorerUrl}${txId}`
          );
        }
      }
    }
    // Detect and process Tatum payload (TRON)
    else if (
      body.subscriptionType === "ADDRESS_EVENT" &&
      body.chain &&
      body.chain.toLowerCase().startsWith("tron")
    ) {
      const { amount, txId, type, tokenId, chain } = body;

      // Skip outgoing or zero amounts (amount is positive for incoming)
      if (parseFloat(amount) <= 0) {
        return res.status(200).json({ success: true });
      }

      const chainName = "TRON";
      const explorerUrl = chain.toLowerCase().includes("testnet")
        ? "https://nile.tronscan.org/#/transaction/"
        : "https://tronscan.org/#/transaction/";
      const usdtContract = "tr7nhqjekqxgtci8q8zy4pl8otszgjlj6t"; // USDT TRC20 (lowercase)

      // Native TRX or USDT TRC20
      // Handle INCOMING_INTERNAL_TX (likely native TRX) or ADDRESS_EVENT (native/token)
      if (
        subscriptionType === "INCOMING_INTERNAL_TX" ||
        (subscriptionType === "ADDRESS_EVENT" &&
          ((type === "native" && body.asset === "TRON") ||
            (type === "token" &&
              tokenId &&
              tokenId.toLowerCase() === usdtContract)))
      ) {
        messages.push(
          ` On ${chainName}: ${explorerUrl}${txId}`
        );
      }
    } else {
      // Unsupported payload
      return res.status(200).json({ success: true });
    }

    // Send messages to Telegram
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

// Test endpoint
app.get("/", (req, res) => {
  res.send("Server is running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
